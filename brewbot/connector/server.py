"""Brew-bot MCP connector.

Exposes the rig to any Claude as four tools: brew, status, menu, cancel.
Runs in simulator mode by default, so it works with no hardware:

    pip install "mcp[cli]<2" uvicorn
    python server.py                 # MCP at http://localhost:8765/mcp, status page at /
    BREWBOT_HW=1 python server.py    # on the Pi, drives the real GPIO (see hw.py notes below)

Auth: set BREWBOT_TOKEN and give that token to people you trust; requests
without `Authorization: Bearer <token>` are refused. One brew per caller every
10 minutes, and one brew at a time on the rig.
"""
import asyncio, json, os, time, uuid

from mcp.server.fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse

TOKEN = os.environ.get("BREWBOT_TOKEN", "dev-token")
HW = os.environ.get("BREWBOT_HW") == "1"
COOLDOWN_S = 600
MAX_OUT_G = 450

MENU = {
    "riverdale": {"name": "Riverdale Estate N72 (Blue Tokai)", "hopper": 0, "roast": "light",
                  "default": {"grams": 18, "temp_c": 93, "ratio": 15, "bloom_s": 45}},
    "attikan":   {"name": "Attikan Estate (medium)", "hopper": 1, "roast": "medium",
                  "default": {"grams": 18, "temp_c": 92, "ratio": 16, "bloom_s": 30}},
    "dark":      {"name": "Dark roast", "hopper": 2, "roast": "dark",
                  "default": {"grams": 20, "temp_c": 88, "ratio": 15, "bloom_s": 30}},
}

state = {"stage": "idle", "brew": None, "grams": 0.0, "water_c": 25.0, "out_g": 0.0,
         "cup": "present", "updated": time.time(), "log": []}
last_brew_by: dict[str, float] = {}
task: asyncio.Task | None = None


def log(msg):
    state["log"] = (state["log"] + [f"{time.strftime('%H:%M:%S')} {msg}"])[-30:]
    state["updated"] = time.time()


# --- hardware layer: simulator by default ------------------------------------
class Rig:
    """Each method is one physical action. The simulator just animates numbers;
    with BREWBOT_HW=1 these are where the GPIO calls go (pins on sameep.ai/brewbot)."""
    async def cup_present(self) -> bool:
        return state["cup"] == "present"          # HW: HX711 #2 tare window + VL53L0X distance
    async def dose(self, hopper: int, grams: float):
        while state["grams"] < grams:             # HW: DRV8833 auger on until HX711 #1 >= grams
            state["grams"] = min(grams, state["grams"] + 0.6); await asyncio.sleep(0.1)
    async def grind(self, seconds: float):
        await asyncio.sleep(seconds)              # HW: Shelly 1 /rpc/Switch.Set?id=0&on=true, then off
    async def heat(self, temp_c: float):
        while state["water_c"] < temp_c:          # HW: Stagg holds temp; DS18B20 must read within 1 C
            state["water_c"] = min(temp_c, state["water_c"] + 1.5); await asyncio.sleep(0.1)
    async def pour(self, grams: float, rate_gps: float = 5.0):
        target = state["out_g"] + grams           # HW: tilt stepper + turntable + rail, closed loop on HX711 #2
        while state["out_g"] < target:
            if not await self.cup_present():
                raise RuntimeError("cup removed mid-pour")
            state["out_g"] = min(target, state["out_g"] + rate_gps * 0.1)
            if state["out_g"] > MAX_OUT_G:
                raise RuntimeError("overflow guard")
            await asyncio.sleep(0.1)
    async def stop_all(self):
        pass                                      # HW: steppers disabled (spring returns kettle), plugs off

rig = Rig()


async def run_brew(b):
    try:
        state.update(stage="dosing", grams=0.0, out_g=0.0); log(f"brew {b['id']}: {b['coffee']} {b['grams']} g {b['temp_c']} C")
        await rig.dose(MENU[b["coffee"]]["hopper"], b["grams"])
        state["stage"] = "grinding"; await rig.grind(3)
        state["stage"] = "heating"; await rig.heat(b["temp_c"])
        bloom_g = round(b["grams"] * 2.5)
        state["stage"] = "bloom"; await rig.pour(bloom_g); await asyncio.sleep(b["bloom_s"] / (10 if not HW else 1))
        left = b["out_g"] - bloom_g
        for i in range(3):
            state["stage"] = f"pulse {i + 1}/3"; await rig.pour(left / 3); await asyncio.sleep(1)
        state["stage"] = "done"; log(f"brew {b['id']} done: {state['out_g']:.0f} g")
    except asyncio.CancelledError:
        await rig.stop_all(); state["stage"] = "cancelled"; log("cancelled"); raise
    except Exception as e:
        await rig.stop_all(); state["stage"] = "error"; log(f"stopped: {e}")


# --- MCP tools ---------------------------------------------------------------
mcp = FastMCP("brewbot", host="0.0.0.0", port=int(os.environ.get("PORT", 8765)))


@mcp.tool()
async def menu() -> dict:
    """The three coffees in the hoppers and their default recipes."""
    return MENU


@mcp.tool()
async def brew(coffee: str, grams: float = 18, temp_c: float = 92, out_ml: float | None = None,
               ratio: float | None = None, bloom_s: float = 45, style: str = "v60", caller: str = "anon") -> dict:
    """Brew a pour-over. coffee is riverdale, attikan or dark. grams 8-40, temp_c 80-99,
    out_ml up to 450 (or give ratio, e.g. 15 for 1:15). style is v60 or origami."""
    global task
    coffee = coffee.lower().strip()
    if coffee not in MENU:
        return {"error": f"unknown coffee; pick one of {list(MENU)}"}
    if task and not task.done():
        return {"error": "busy", "stage": state["stage"]}
    if time.time() - last_brew_by.get(caller, 0) < COOLDOWN_S:
        return {"error": "rate limited: one brew per person every 10 minutes"}
    if not await rig.cup_present():
        return {"error": "no cup on the scale, so no pour"}
    grams = max(8, min(40, grams)); temp_c = max(80, min(99, temp_c))
    out = out_ml or grams * (ratio or MENU[coffee]["default"]["ratio"])
    b = {"id": "b_" + uuid.uuid4().hex[:4], "coffee": coffee, "grams": grams, "temp_c": temp_c,
         "out_g": min(MAX_OUT_G, out), "bloom_s": max(0, min(90, bloom_s)), "style": style}
    state["brew"] = b; last_brew_by[caller] = time.time()
    task = asyncio.create_task(run_brew(b))
    return {"brew_id": b["id"], "stage": "dosing", "eta_s": int(60 + b["bloom_s"] + 120), "status_url": "/"}


@mcp.tool()
async def status() -> dict:
    """Live state of the rig: stage, grams dosed, water temperature, grams in the cup."""
    return {k: state[k] for k in ("stage", "brew", "grams", "water_c", "out_g", "cup")}


@mcp.tool()
async def cancel() -> dict:
    """Stop everything now: motors off, kettle tips upright, plugs off."""
    if task and not task.done():
        task.cancel()
    return {"stage": "cancelled"}


# --- status page + auth ------------------------------------------------------
PAGE = """<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Brew-bot status</title>
<style>body{font:16px system-ui;background:#17110c;color:#f2e8dd;margin:0;padding:24px}b{font:600 32px ui-monospace}div{margin:12px 0}pre{color:#b3a294}</style>
<h1>Brew-bot</h1><div>stage <b id=s></b></div><div>beans <b id=g></b> g · water <b id=w></b> °C · cup <b id=o></b> g</div><pre id=l></pre>
<script>setInterval(async()=>{const r=await (await fetch('/state')).json();s.textContent=r.stage;g.textContent=r.grams.toFixed(1);
w.textContent=r.water_c.toFixed(0);o.textContent=r.out_g.toFixed(0);l.textContent=r.log.join('\\n')},500)</script>"""


@mcp.custom_route("/", methods=["GET"])
async def page(_: Request):
    return HTMLResponse(PAGE)


@mcp.custom_route("/state", methods=["GET"])
async def state_json(_: Request):
    return JSONResponse(state)


def app():
    inner = mcp.streamable_http_app()

    async def guarded(scope, receive, send):
        if scope["type"] == "http" and scope["path"].startswith("/mcp"):
            auth = dict(scope["headers"]).get(b"authorization", b"").decode()
            if auth != f"Bearer {TOKEN}":
                return await JSONResponse({"error": "unauthorized"}, 401)(scope, receive, send)
        await inner(scope, receive, send)
    return guarded


if __name__ == "__main__":
    import uvicorn
    print(f"Brew-bot ({'hardware' if HW else 'simulator'}) on :{mcp.settings.port} · token {TOKEN}")
    uvicorn.run(app(), host="0.0.0.0", port=mcp.settings.port)
