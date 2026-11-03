#!/usr/bin/env python3
"""sprite.py: the guest's pixel-art lip-sync frames (and the CV image), with Pillow.

  python3 sprite.py frames <photo> --out img/sprites/guest [--mouth X,Y,W] [--eyes X1,Y1,X2,Y2] [--px 4] [--tone warm|none]
  python3 sprite.py placeholder --name "Their Name" --out img/sprites/guest     (no photo: a pixel stand-in)
  python3 sprite.py cv <cv-page.png> --out img/hero                              (an already-redacted CV page)
  python3 sprite.py preview img/sprites/guest --site .                           (the 4 frames in the studio seat, as one png)

frames: on a Mac, face.swift (Apple Vision, on-device) cuts the person out and finds the mouth and eyes.
Elsewhere, or if it misses, pass --mouth / --eyes in photo pixels, else it assumes a centred head-and-
shoulders shot. The cut-out is pixelated (--px = screen pixels per art pixel), reduced to a small
palette, outlined, warmed to the studio's lamp light, and placed in the guest seat's 607x536 canvas.
Then the mouth is opened (mid, open) and the eyes shut (blink) on the art-pixel grid, so all four frames
line up exactly. Output: closed.webp, mid.webp, open.webp, blink.webp (+ wide/oo copies).

If the person has an image model of their own (an MCP or app), the better route is: generate one
portrait in the studio's pixel-art style from their photo (img/sprites/host/closed.webp is the style and
framing reference), then run `frames` on that image with --px 1 so it only adds the mouth/blink frames.
"""
import argparse, json, random, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = Path(__file__).resolve().parent
CW, CH = 607, 536            # the guest seat's canvas (same as the engine's guest sprites)
FIG = (0.60, 0.04, 0.70)     # figure: centre x, top, width (fractions of the canvas)
OUTLINE = (26, 20, 16, 255)
MOUTH_IN = (58, 22, 20, 255)
TEETH = (236, 226, 210, 255)


def landmarks(photo):
    """face.swift → (mask image or None, dict). Silent fallback when Swift/Vision isn't there."""
    if sys.platform != "darwin" or not shutil.which("swift"):
        return None, {}
    with tempfile.TemporaryDirectory() as td:
        m = Path(td) / "mask.png"
        try:
            r = subprocess.run(["swift", str(HERE / "face.swift"), str(photo), str(m)], capture_output=True, text=True, timeout=180)
            info = json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode == 0 and r.stdout.strip() else {}
            mask = Image.open(m).convert("L").copy() if m.exists() else None
            return mask, info
        except Exception as e:
            print("face.swift didn't run:", e, file=sys.stderr)
            return None, {}


def oval_mask(size, face):
    w, h = size
    m = Image.new("L", size, 0); d = ImageDraw.Draw(m)
    fx, fy, fw, fh = face
    d.ellipse([fx - fw * 0.08, fy - fh * 0.35, fx + fw * 1.08, fy + fh * 1.1], fill=255)          # head
    d.ellipse([fx - fw * 0.9, fy + fh * 1.0, fx + fw * 1.9, fy + fh * 3.2], fill=255)             # shoulders
    d.rectangle([fx - fw * 0.9, fy + fh * 2.0, fx + fw * 1.9, h], fill=255)
    return m.filter(ImageFilter.GaussianBlur(2))


def build_frames(base, mouth, eyes, px, out):
    """base: RGBA art at grid size; mouth (x, y, w) and eyes [(x, y), (x, y)] in grid pixels."""
    out.mkdir(parents=True, exist_ok=True)
    mx, my, mw = mouth
    mw = max(4, mw)
    skin = base.getpixel((int(mx), int(max(0, my - mw * 0.55))))
    frames = {"closed": base.copy()}
    for k, (fw, fh) in {"mid": (0.42, 0.16), "open": (0.5, 0.32)}.items():
        f = base.copy(); d = ImageDraw.Draw(f)
        rw, rh = max(2, mw * fw), max(1.2, mw * fh)
        d.ellipse([mx - rw, my - rh * 0.6, mx + rw, my + rh], fill=MOUTH_IN, outline=OUTLINE)
        if k == "open" and rw > 3:
            d.rectangle([mx - rw * 0.6, my - rh * 0.55, mx + rw * 0.6, my - rh * 0.25], fill=TEETH)
        frames[k] = f
    f = base.copy(); d = ImageDraw.Draw(f)
    ew = max(2.5, mw * 0.32)
    for ex, ey in eyes:
        d.rectangle([ex - ew, ey - ew * 0.6, ex + ew, ey + ew * 0.35], fill=skin)
        d.line([ex - ew, ey + ew * 0.35, ex + ew, ey + ew * 0.35], fill=OUTLINE, width=1)
    frames["blink"] = f
    for k, im in frames.items():
        big = im.resize((CW, CH), Image.NEAREST) if px > 1 else im
        big.save(out / f"{k}.webp", lossless=True)
    shutil.copy(out / "open.webp", out / "wide.webp"); shutil.copy(out / "mid.webp", out / "oo.webp")
    print(f"wrote {out}/{{closed,mid,open,blink}}.webp")


def place(cut, face, px, tone):
    """Scale the cut-out so the face lands where a guest's face sits, onto the grid-size canvas."""
    gw, gh = CW // px, CH // px
    fx, fy, fw, fh = face
    scale = (gw * FIG[2] * 0.34) / fw                 # face ≈ a third of the figure's width
    im = cut.resize((max(1, int(cut.width * scale)), max(1, int(cut.height * scale))), Image.LANCZOS)
    ox = int(gw * FIG[0] - (fx + fw / 2) * scale)
    oy = int(gh * FIG[1] + fh * 0.4 * scale - fy * scale)
    canvas = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    canvas.paste(im, (ox, oy), im)
    return canvas, (lambda x, y: ((x * scale) + ox, (y * scale) + oy)), scale


def pixelise(rgba, colours=28, tone="warm"):
    a = rgba.getchannel("A").point(lambda v: 255 if v > 110 else 0)
    rgb = rgba.convert("RGB")
    if tone == "warm":       # the studio is lit by a lamp: lift reds, drop blues a touch
        r, g, b = rgb.split()
        rgb = Image.merge("RGB", (r.point(lambda v: min(255, int(v * 1.06 + 6))), g, b.point(lambda v: int(v * 0.88))))
    rgb = ImageOps.autocontrast(rgb, cutoff=1)
    q = rgb.quantize(colors=colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    q.putalpha(a)
    # 1-px dark outline round the figure, like the hosts
    edge = a.filter(ImageFilter.MaxFilter(3))
    ring = Image.new("RGBA", q.size, OUTLINE); ring.putalpha(Image.eval(edge, lambda v: v))
    ring.alpha_composite(q)
    ring.putalpha(edge)
    return ring


def cmd_frames(a):
    photo = Image.open(a.photo); photo = ImageOps.exif_transpose(photo).convert("RGB")
    mask, info = landmarks(a.photo) if not (a.mouth and a.eyes) else (None, {})
    W, H = photo.size
    if a.mouth: mx, my, mw = map(float, a.mouth.split(","))
    elif "mouth" in info: mx, my, mw = info["mouth"]
    else: mx, my, mw = W * 0.5, H * 0.52, W * 0.12
    if a.eyes: e = list(map(float, a.eyes.split(","))); eyes = [(e[0], e[1]), (e[2], e[3])]
    elif "eyes" in info: eyes = [tuple(p) for p in info["eyes"]]
    else: eyes = [(W * 0.42, H * 0.38), (W * 0.58, H * 0.38)]
    if "face" in info: face = info["face"]
    else:
        fw = abs(eyes[1][0] - eyes[0][0]) * 2.4; face = (mx - fw / 2, (eyes[0][1] + eyes[1][1]) / 2 - fw * 0.55, fw, fw * 1.3)
    if mask is None or a.no_cutout:
        mask = oval_mask((W, H), face) if not a.no_cutout else Image.new("L", (W, H), 255)
        print("cut-out: oval (no Vision mask)" if not a.no_cutout else "cut-out: none (image already has a transparent background?)")
    cut = photo.convert("RGBA"); cut.putalpha(mask.resize((W, H)))
    if a.px > 1:
        grid, to, scale = place(cut, face, a.px, a.tone)
        base = pixelise(grid, tone=a.tone)
    else:   # already pixel art at canvas size (made by an image model): keep it as-is
        grid, to, scale = place(cut, face, 1, "none")
        base = grid
    m = to(mx, my); e = [to(*p) for p in eyes]
    build_frames(base, (m[0], m[1], mw * scale), e, a.px, Path(a.out))
    if info: print("landmarks:", json.dumps({k: info[k] for k in ("mouth", "eyes") if k in info}))


def cmd_placeholder(a):
    """A pixel stand-in for someone who'd rather not use a photo (or for a dry run)."""
    rnd = random.Random(a.name)
    px = 4; gw, gh = CW // px, CH // px
    skins = [(241, 200, 170), (224, 172, 130), (198, 140, 100), (160, 105, 72), (112, 72, 50)]
    hairs = [(40, 28, 22), (92, 58, 36), (176, 120, 60), (30, 30, 34), (200, 196, 190), (120, 40, 30)]
    shirts = [(10, 143, 168), (255, 138, 31), (255, 79, 123), (123, 79, 214), (155, 209, 58), (52, 60, 72)]
    skin, hair, shirt = rnd.choice(skins), rnd.choice(hairs), rnd.choice(shirts)
    dk = lambda c, k=0.72: tuple(int(v * k) for v in c)
    im = Image.new("RGBA", (gw, gh), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cx, top = int(gw * FIG[0]), int(gh * 0.08)
    hw, hh = 22, 27                                     # half head
    lt = lambda c, k=1.12: tuple(min(255, int(v * k)) for v in c)
    sy = top + 2 * hh + 4                                                                                     # shoulders
    d.ellipse([cx - 66, sy, cx + 66, sy + 150], fill=shirt, outline=OUTLINE)
    d.pieslice([cx - 66, sy, cx + 66, sy + 150], 300, 60, fill=dk(shirt, 0.82))                            # lamp light from the left
    d.polygon([(cx - 13, sy + 1), (cx + 13, sy + 1), (cx, sy + 18)], fill=dk(shirt, 0.6))                   # collar
    d.rectangle([cx - 9, top + 2 * hh - 8, cx + 9, sy + 4], fill=dk(skin, 0.86))                             # neck
    d.ellipse([cx - hw - 4, top + hh - 6, cx - hw + 5, top + hh + 8], fill=skin, outline=OUTLINE)            # ears
    d.ellipse([cx + hw - 5, top + hh - 6, cx + hw + 4, top + hh + 8], fill=dk(skin, 0.9), outline=OUTLINE)
    d.ellipse([cx - hw, top, cx + hw, top + 2 * hh], fill=skin, outline=OUTLINE)                             # head
    d.chord([cx - hw, top, cx + hw, top + 2 * hh], 290, 70, fill=dk(skin, 0.9))                              # cheek shade
    style = rnd.randint(0, 2)                                                                                # hair
    d.ellipse([cx - hw - 3, top - 8, cx + hw + 3, top + hh + 4], fill=hair, outline=OUTLINE)
    d.ellipse([cx - hw + 3, top + 12, cx + hw - 3, top + 2 * hh - 1], fill=skin)                             # forehead under the fringe
    d.chord([cx - hw + 3, top + 12, cx + hw - 3, top + 2 * hh - 1], 290, 70, fill=dk(skin, 0.9))
    if style == 1: d.rectangle([cx - hw - 3, top + hh * 0.5, cx - hw + 4, top + hh * 1.5], fill=hair, outline=OUTLINE)
    if style == 2: d.ellipse([cx - 10, top - 14, cx + 12, top + 2], fill=hair, outline=OUTLINE)
    d.arc([cx - hw - 1, top - 6, cx + hw - 6, top + hh], 200, 260, fill=lt(hair, 1.6), width=2)              # shine
    ey = top + hh + 3
    eyes = [(cx - 9, ey), (cx + 9, ey)]
    for ex, _ in eyes:
        d.rectangle([ex - 2, ey - 2, ex + 2, ey + 2], fill=(250, 248, 240)); d.rectangle([ex - 2, ey - 1, ex, ey + 2], fill=OUTLINE)
        d.line([ex - 4, ey - 6, ex + 3, ey - 7], fill=dk(hair, 0.8), width=1)                               # brows
    d.line([cx - 1, ey + 3, cx - 2, ey + 9], fill=dk(skin, 0.72)); d.line([cx - 2, ey + 10, cx + 1, ey + 10], fill=dk(skin, 0.72))  # nose
    mx, my = cx - 1, top + int(hh * 1.58)
    d.line([mx - 6, my, mx + 6, my], fill=dk(skin, 0.5), width=1)
    d.point([(mx - 7, my - 1), (mx + 7, my - 1)], fill=dk(skin, 0.6))
    build_frames(im, (mx, my, 14), eyes, px, Path(a.out))


def cmd_cv(a):
    """An already-redacted CV page → img/hero/cv-front.webp + cv-back.webp (1400x1980, the hero's paper)."""
    src = ImageOps.exif_transpose(Image.open(a.image)).convert("RGB")
    paper = Image.new("RGB", (1400, 1980), (243, 238, 226))
    page = ImageOps.contain(src, (1320, 1900), Image.LANCZOS)
    paper.paste(page, ((1400 - page.width) // 2, (1980 - page.height) // 2))
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    paper.save(out / "cv-front.webp", quality=90)
    back = Image.blend(Image.new("RGB", paper.size, (239, 233, 220)), ImageOps.mirror(paper).filter(ImageFilter.GaussianBlur(3)), 0.12)
    back.save(out / "cv-back.webp", quality=88)
    print(f"wrote {out}/cv-front.webp, cv-back.webp. Check it shows no phone, email or address.")


def cmd_preview(a):
    """The four frames sitting in the studio, side by side, to eyeball the framing."""
    site = Path(a.site); M = json.loads((site / "img/manifest.json").read_text())["studio"]
    bg = Image.open(site / M["bg"]).convert("RGBA"); fg = Image.open(site / M["deskFg"]["src"]).convert("RGBA")
    S = M["size"]; seat = M["seats"].get("guest") or M["seats"]["sameep"]; hs = M["seats"]["host"]
    def shot(k):
        c = bg.resize(S).copy()
        for box, f in ((hs["box"], site / "img/sprites/host/closed.webp"), (seat["box"], Path(a.dir) / f"{k}.webp")):
            im = Image.open(f).convert("RGBA").resize((int(box[2] * S[0]), int(box[3] * S[1])))
            c.alpha_composite(im, (int(box[0] * S[0]), int(box[1] * S[1])))
        fb = M["deskFg"]["box"]; c.alpha_composite(fg.resize((int(fb[2] * S[0]), int(fb[3] * S[1]))), (int(fb[0] * S[0]), int(fb[1] * S[1])))
        return c.resize((S[0] // 2, S[1] // 2))
    tiles = [shot(k) for k in ("closed", "mid", "open", "blink")]
    sheet = Image.new("RGBA", (tiles[0].width * 2, tiles[0].height * 2))
    for i, t in enumerate(tiles): sheet.paste(t, ((i % 2) * t.width, (i // 2) * t.height))
    o = Path(a.dir) / "preview.png"; sheet.save(o); print("wrote", o)


ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
p = sub.add_parser("frames"); p.add_argument("photo"); p.add_argument("--out", required=True); p.add_argument("--mouth"); p.add_argument("--eyes")
p.add_argument("--px", type=int, default=4); p.add_argument("--tone", default="warm"); p.add_argument("--no-cutout", action="store_true")
p = sub.add_parser("placeholder"); p.add_argument("--name", required=True); p.add_argument("--out", required=True)
p = sub.add_parser("cv"); p.add_argument("image"); p.add_argument("--out", required=True)
p = sub.add_parser("preview"); p.add_argument("dir"); p.add_argument("--site", default=".")
a = ap.parse_args()
{"frames": cmd_frames, "placeholder": cmd_placeholder, "cv": cmd_cv, "preview": cmd_preview}[a.cmd](a)
