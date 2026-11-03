#!/usr/bin/env python3
"""scaffold.py: build someone's own sameep.ai-style site from the open-source engine and ONE config file.

  python3 scaffold.py --me me.json --out ./my-site [--engine PATH_TO_SITE | --repo URL] [--episode episode.json]
                      [--sprites DIR] [--cv-image cv.png] [--force]

What it does, in order:
  1. Gets the engine: --engine (a local checkout's site folder) or a shallow clone of --repo
     (default https://github.com/sameeeeeeep/sameep.ai).
  2. Copies it to --out, leaving out everything that is about Sameep (STRIP below): his case studies,
     clips, video, work shots, his sprite, the Wispr team's faces, the analytics Worker, his domain.
  3. Writes the person's persona.json, data/episode.json (theirs, or a starter one built from me.json),
     data/work.json, and empty durations/visemes/words (run the voice step to fill them).
  4. Patches the few engine spots that hard-code Sameep (each patch checks its anchor and says so if the
     engine has moved on; fix those by hand, the report lists them).
  5. Prints a leftovers report: any "Sameep / Wispr / Nykaa ..." text still in the copy.
Only python3 stdlib (git for --repo).
"""
import argparse, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = "https://github.com/sameeeeeeep/sameep.ai"
MAKE_URL = "https://sameep.ai/make"

# Everything below is Sameep's, not the engine's. Paths are relative to the site root.
STRIP = [
    "CNAME", "README.md", "hero-dev.html", "persona.json", ".git", ".github", ".claude",
    "make", "skill", "llms.txt", "analytics", "tools",
    # his case studies and side projects (each a folder of its own)
    "pinkbox", "khushi-launch", "secretslumberparty", "often", "nia", "copyflow", "cut", "annotate",
    "pastedeck", "reachout", "repurpose", "growth-os",
    # his media
    "video", "audio/clips", "img/sprites/sameep", "img/work", "img/cutaways", "img/events", "img/making",
    "img/hero/cv-front.webp", "img/hero/cv-back.webp", "img/og.png", "img/studio/med-sameep.webp",
    "img/studio/studio-photo.webp", "img/studio/studio-wide.webp",
    # his data (regenerated below)
    "data",
    # the Wispr version's extras
    "css/growthos.css", "css/review.css", "css/case.css",
    "js/app/growthos.js", "js/app/growthos-data.js",
]
STRIP_GLOBS = ["img/characters/w-*", "img/sprites/hosts/chip*", "img/ui/wispr.svg", "img/ui/styleguide.svg"]
LEFTOVER = re.compile(r"sameep|rehlan|nykaa|nailinit|khushi|mosaic|shopclues|wispr|diwali|slumber|foyra gold is sameep", re.I)
# lines allowed to keep a mention: the make-your-own call to action and the open-source credit
ALLOW = re.compile(r"sameep\.ai/make|make your own sameep\.ai|MAKE_URL|MAKE_SAY|Made with the open-source|sameeeeeeep/sameep\.ai|isWispr|VERSION|wispr-flow|version=wispr|wisprTeam|\bWispr Flow\b", re.I)


def log(*a):
    print(*a, flush=True)


def get_engine(a):
    if a.engine:
        src = Path(a.engine).expanduser().resolve()
        if not (src / "js/app/podcast.js").exists():
            sys.exit(f"--engine {src} doesn't look like the site folder (no js/app/podcast.js)")
        return src, None
    td = Path(tempfile.mkdtemp(prefix="otcv-engine-"))
    log(f"cloning {a.repo} (shallow) ...")
    subprocess.run(["git", "clone", "--depth", "1", a.repo, str(td / "repo")], check=True)
    root = td / "repo"
    src = root / "site" if (root / "site/js/app/podcast.js").exists() else root
    return src, td


def copy_engine(src, out):
    skip = {(src / p).resolve() for p in STRIP}
    for g in STRIP_GLOBS:
        skip |= {p.resolve() for p in src.glob(g)}

    def ignore(d, names):
        return [n for n in names if (Path(d) / n).resolve() in skip or n in (".DS_Store", "__pycache__") or n.endswith((".bak", ".orig"))]

    shutil.copytree(src, out, ignore=ignore, dirs_exist_ok=True)
    for sub in ("data", "audio/clips", "img/sprites/guest", "img/hero"):
        (out / sub).mkdir(parents=True, exist_ok=True)


# ----------------------------------------------------------------------------- config → files
def persona_json(me, src_persona):
    name = me["name"].strip()
    short = me.get("shortName") or name.split()[0]
    links = [l for l in me.get("links", []) if l.get("url")]
    if me.get("github") and not any("github.com" in l["url"] for l in links):
        links.insert(0, {"label": f"github.com/{me['github']}", "url": f"https://github.com/{me['github']}", "kind": "github"})
    links.insert(0, {"label": "Make your own", "url": MAKE_URL, "kind": "make"})
    base = {k: src_persona[k] for k in ("characters", "wallpaper", "stage", "music") if k in src_persona}
    base["characters"] = [c for c in base.get("characters", []) if not c.get("team")]
    return {
        "version": 1,
        "name": name,
        "shortName": short,
        "tagline": me.get("tagline", ""),
        "appName": me.get("appName", "OFF THE CV.app"),
        "appTagline": me.get("appTagline", "90s software that walks you through someone’s work with AI. In the form of a podcast."),
        "discLabel": me.get("discLabel", f"{short.upper()} — WORK — DO NOT LOSE"),
        "showName": me.get("showName", "Off the CV"),
        "episodeTitle": me.get("episodeTitle", "Ep. 01"),
        "episodeUrl": "data/episode.json",
        "studio": ["img/studio/studio-bg.webp"],
        "host": {"id": "host", "name": me.get("hostName", "Foyra Gold"), "sprite": "img/sprites/host", "side": "left"},
        "guest": {"id": "guest", "name": f"{short} (AI)", "sprite": "img/sprites/guest", "side": "right"},
        "sprites": "img/sprites/guest",
        "links": links,
        "work": [],
        **base,
    }


def work_json(me):
    out = []
    for p in me.get("projects", []):
        links = [{"label": p.get("linkLabel", "Open"), "url": p["url"]}] if p.get("url") else []
        if p.get("repo") and p.get("repo") != p.get("url"):
            links.append({"label": "GitHub", "url": p["repo"]})
        out.append({"id": slug(p.get("id") or p["title"]), "title": p["title"], "oneLiner": p.get("blurb", ""),
                    "status": p.get("status", ""), "links": links, "shots": p.get("shots", [])})
    return out


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")[:40] or "x"


def js_str(s):
    return json.dumps(s, ensure_ascii=False)


# ----------------------------------------------------------------------------- patches
class Patcher:
    def __init__(self, out):
        self.out, self.missed = out, []

    def sub(self, rel, pattern, repl, *, count=1, flags=0, why=""):
        f = self.out / rel
        if not f.exists():
            self.missed.append(f"{rel}: file missing ({why})"); return
        s = f.read_text()
        n = len(re.findall(pattern, s, flags))
        if n == 0:
            self.missed.append(f"{rel}: anchor not found ({why})"); return
        f.write_text(re.sub(pattern, repl, s, count=count, flags=flags))

    def write(self, rel, text):
        (self.out / rel).parent.mkdir(parents=True, exist_ok=True)
        (self.out / rel).write_text(text)


def stub_module(src_text, header):
    """A no-op module with the same exports (functions return nothing)."""
    names = re.findall(r"^export (?:async )?function (\w+)", src_text, re.M)
    consts = re.findall(r"^export const (\w+)", src_text, re.M)
    body = [header] + [f"export function {n}() {{}}" for n in names] + [f"export const {n} = null;" for n in consts]
    return "\n".join(body) + "\n"


def apply_patches(out, me, persona):
    P = Patcher(out)
    name, short = persona["name"], persona["shortName"]
    cv = me.get("cv", {})
    gh = me.get("github")

    # Sameep's own services: never send their visitors' data to his Worker
    for rel, why in (("js/analytics.js", "analytics went to sameep.ai/api/e"), ("js/presence.js", "room count from sameep.ai/api/here"),
                     ("js/review.js", "Sameep's review-mode notes")):
        f = out / rel
        if f.exists():
            P.write(rel, stub_module(f.read_text(), f"// {Path(rel).name}: switched off in this copy ({why}). Add your own if you want it."))
    # the Wispr hiring-challenge version is Sameep's: always the default version here
    P.sub("js/version.js", r"export const VERSION = [^;]+;", "export const VERSION = 'default';", why="force the default version")

    # index.html: title, description, social cards, no canonical to sameep.ai
    title = f"{persona['showName']} — {name}"
    desc = me.get("description") or f"{name}'s work, as a podcast you steer by talking. {persona['tagline']}".strip()
    P.sub("index.html", r"<title>.*?</title>", f"<title>{esc(title)}</title>", why="title")
    P.sub("index.html", r'(<meta name="description" content=")[^"]*', rf"\g<1>{esc(desc)}", why="description")
    P.sub("index.html", r'\s*<link rel="canonical"[^>]*>', "", why="canonical")
    P.sub("index.html", r'\s*<meta property="og:url"[^>]*>', "", why="og:url")
    P.sub("index.html", r'\s*<meta (property="og:image"|name="twitter:image")[^>]*>', "", count=0, why="og image (his)")
    P.sub("index.html", r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*', rf"\g<1>{esc(title)}", count=0, why="og title")
    P.sub("index.html", r'(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*', rf"\g<1>{esc(desc)}", count=0, why="og description")
    P.sub("index.html", r"github\.com/sameeeeeeep", f"github.com/{gh}" if gh else "GitHub", why="noscript")
    P.sub("index.html", r'\s*<script type="module" src="js/review.js"></script>', "", why="review mode")
    P.sub("index.html", r'\s*<link rel="stylesheet" href="css/growthos.css">', "", why="growth os css")

    # the CV that gets shredded: drawn from cv.js (his pre-rendered cv-front.webp is gone, so the canvas runs)
    roles = [{"co": r.get("company", ""), "role": r.get("role", "")} for r in cv.get("roles", [])][:6] or [{"co": "Somewhere", "role": "Something"}]
    P.write("js/hero/cv.js", "// cv.js — the CV that gets shredded in the hero. Written by scaffold.py from me.json.\n"
            f"export const CV = {json.dumps({'name': name, 'headline': cv.get('headline', persona['tagline']), 'roles': roles}, ensure_ascii=False, indent=2)};\n")
    P.sub("js/hero/textures.js", r"^", "import { CV } from './cv.js';\n", why="import cv.js")
    P.sub("js/hero/textures.js", r"const ROLES = \[[\s\S]*?\];", "const ROLES = CV.roles;", why="CV roles")
    P.sub("js/hero/textures.js", r"ctx\.fillText\('Sameep Rehlan', ", "ctx.fillText(CV.name, ", why="CV name")
    P.sub("js/hero/textures.js", r"ctx\.fillText\('Building consumer products and practical AI tools\.', ", "ctx.fillText(CV.headline, ", why="CV headline")
    P.sub("js/hero/textures.js", r"ctx\.fillText\('SAMEEP', ", "ctx.fillText(CV.name.split(' ')[0].toUpperCase(), ", why="CD label")
    # any company without a hand-drawn wordmark gets a plain text one
    P.sub("js/hero/textures.js", r"(\n    void s;\n  \})\n  ctx\.restore\(\);",
          r"\1 else {\n    fitText(ctx, id, w, h * 0.55, 800, B);\n    ctx.fillStyle = INK;\n    ctx.fillText(id, x, cy);\n  }\n  ctx.restore();", why="generic wordmark")
    env = me.get("envelopeLine") or (cv.get("roles") or [{}])[0].get("role") or "Work"
    P.sub("js/hero/textures.js", r"'Growth · product · AI'", js_str(env), why="envelope address line")
    P.sub("js/hero/main.js", r'(<p class="hero-mark"><span>)Sameep Rehlan(</span>)', rf"\g<1>{esc(name)}\g<2>", why="hero mark")

    # desktop folders: their projects, grouped by folder (folder ids reuse the engine's folder icons)
    P.sub("js/app/era.js", r"export const FOLDERS = \[[\s\S]*?\n\];", "export const FOLDERS = " + folders_js(me) + ";", why="desktop folders")
    # desktop icons that are Sameep's or Wispr's
    P.sub("js/app/main.js", r"'wispr', 'styleguide', ", "", why="Wispr + style guide icons")
    P.sub("js/app/main.js", r"\n\s*if \(loggedIn\) import\('\./growthos\.js'\)[^\n]*", "", why="Growth OS (Wispr teammates only)")
    P.sub("js/app/main.js", r"\s*\{ id: 'emergent', label: 'Emergent', icon: 'proj-emergent', url: 'https://emergent.sh/' \},", "", why="Emergent icon")
    P.sub("js/app/main.js", r"\['Open Wispr Flow', \(\) => ctx\.open\('wispr'\)\], ", "", why="File menu Wispr item")
    P.sub("js/app/main.js", r"persona = quick\?\.persona \|\| \{ name: 'Sameep Rehlan', shortName: 'Sameep' \};",
          f"persona = quick?.persona || {{ name: {js_str(name)}, shortName: {js_str(short)} }};", why="boot fallback name")
    P.sub("js/app/hostpick.js", r"'Sameep sees the name you type", f"'{short} sees the name you type", why="host picker note")
    for rel in ("js/app/bootseq.js", "js/app/era.js"):
        P.sub(rel, r"persona\.name \|\| 'Sameep Rehlan'", f"persona.name || {js_str(name)}", count=0, why="fallback name")
    P.sub("js/app/bootseq.js", r"persona\.shortName \|\| 'Sameep'", f"persona.shortName || {js_str(short)}", count=0, why="fallback short name")
    P.sub("js/boot.js", r'(<p class="gate__by">)Sameep Rehlan(</p>)', rf"\g<1>{esc(name)}\g<2>", why="startup window byline")
    # the episode map's "By project" tab: their project threads
    P.sub("js/app/projects.js", r"export const PROJECTS = \[[\s\S]*?\n\];", "export const PROJECTS = " + json.dumps([{"group": me.get("folderLabels", {}).get("products", "Projects"),
          "items": [{"work": slug(p.get("id") or p["title"]), "node": "p-" + slug(p.get("id") or p["title"])[:24], "tag": p.get("blurb", "")} for p in me.get("projects", [])]}], ensure_ascii=False, indent=2) + ";", why="episode map projects")
    P.sub("js/app/apps.js", r"github\.com/sameeeeeeep", f"github.com/{gh}" if gh else "github.com", count=0, why="Read Me source line")
    # the installer's progress lines: their projects instead of his
    inst = "".join(f"\n    [{js_str('Installing ' + p['title'] + '…')}, {js_str('projects/' + slug(p.get('id') or p['title']) + '/')}]," for p in me.get("projects", [])[:4])
    P.sub("js/app/era.js", r"\n\s*\['[^'\n]*', 'work/[a-z0-9-]+/'\],", lambda m: inst, why="installer project lines")
    P.sub("js/app/era.js", r"\n\s*\['[^'\n]*', 'work/[a-z0-9-]+/'\],", "", count=0, why="installer project lines (rest)")
    # the steering practice in the welcome window names one of their projects
    first = (me.get("projects") or [{"title": "my work"}])[0]["title"]
    words = sorted({first.lower(), *re.findall(r"[a-z0-9]{3,}", first.lower())})
    P.sub("js/app/onboard.js", r"\{ key: 'ppt', label: 'Tell me about ppt\.live', phrases: \[[^\]]*\] \}",
          lambda m: "{ key: 'ppt', label: " + js_str("Tell me about " + first) + ", phrases: " + json.dumps(words + ["tell me about " + first.lower()], ensure_ascii=False) + " }", why="steering practice")
    P.sub("js/app/infocard.js", r"Opens a page on sameep\.ai", "Opens a page on this site", why="link card")
    P.sub("js/app/stage.js", r"the host and Sameep at a desk", f"the host and {short} at a desk", why="studio alt text")

    P.write("README.md", f"# {persona['showName']}: {name}\n\n{persona['tagline']}\n\n"
            "Made with the open-source sameep.ai engine (https://github.com/sameeeeeeep/sameep.ai, MIT).\n"
            f"Make your own: {MAKE_URL}\n\n"
            "- `persona.json`, `data/episode.json`, `data/work.json`: the content\n"
            "- `img/sprites/guest/`: the guest's 4 lip-sync frames\n"
            "- `audio/clips/`: one mp3 per line; `data/visemes.json`, `data/words.json`, `data/durations.json` are made from them\n")
    if me.get("domain"):
        P.write("CNAME", me["domain"].strip() + "\n")
    return P.missed


def esc(s):
    return str(s).replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace("\\", "\\\\")


FOLDER_IDS = {"products": "Products", "tools": "Tools", "fun": "Fun", "growth": "Work", "switchboard": "More"}


def folders_js(me):
    groups = {}
    for p in me.get("projects", []):
        fid = p.get("folder", "products")
        if fid not in FOLDER_IDS: fid = "products"
        groups.setdefault(fid, []).append(p)
    labels = me.get("folderLabels", {})
    out = []
    for fid, items in groups.items():
        out.append({"id": fid, "label": labels.get(fid, FOLDER_IDS[fid]),
                    "items": [{"id": slug(p.get("id") or p["title"]), "label": p["title"], "icon": p.get("icon", "readme"),
                               "url": p.get("url") or p.get("repo")} for p in items if p.get("url") or p.get("repo")]})
    return json.dumps(out, ensure_ascii=False, indent=2)


def leftovers(out):
    hits = {}
    for f in out.rglob("*"):
        if f.suffix not in (".js", ".html", ".json", ".md") or "vendor" in f.parts or f.name in ("LICENSE", "manifest.json"):
            continue
        for i, line in enumerate(f.read_text(errors="ignore").splitlines(), 1):
            code = line.strip()
            if code.startswith(("//", "/*", "*")): continue   # comments never reach a visitor
            if LEFTOVER.search(line) and not ALLOW.search(line):
                hits.setdefault(str(f.relative_to(out)), []).append((i, line.strip()[:110]))
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--me", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--engine"); ap.add_argument("--repo", default=REPO)
    ap.add_argument("--episode", help="their episode.json (else a starter one is written from me.json)")
    ap.add_argument("--sprites", help="folder with closed/mid/open/blink.webp (else run sprite.py later)")
    ap.add_argument("--cv-image", help="an image of their CV page (redacted!) to use instead of the drawn one")
    ap.add_argument("--force", action="store_true", help="write into a non-empty --out")
    a = ap.parse_args()

    me = json.loads(Path(a.me).read_text())
    for k in ("name",):
        if not me.get(k): sys.exit(f"me.json needs '{k}'")
    out = Path(a.out).expanduser().resolve()
    if out.exists() and any(out.iterdir()) and not a.force:
        sys.exit(f"{out} isn't empty (use --force to write into it)")

    src, tmp = get_engine(a)
    log(f"engine: {src}")
    copy_engine(src, out)
    src_persona = json.loads((src / "persona.json").read_text()) if (src / "persona.json").exists() else {}
    persona = persona_json(me, src_persona)
    (out / "persona.json").write_text(json.dumps(persona, ensure_ascii=False, indent=2))
    (out / "data/work.json").write_text(json.dumps(work_json(me), ensure_ascii=False, indent=2))
    for f in ("durations.json", "visemes.json", "words.json"):
        if not (out / "data" / f).exists(): (out / "data" / f).write_text("{}")
    # the studio still images keyed by the guest seat (the engine falls back to these names)
    if a.episode:
        shutil.copy(a.episode, out / "data/episode.json")
    elif not (out / "data/episode.json").exists():
        subprocess.run([sys.executable, str(HERE / "starter_episode.py"), "--me", a.me, "--out", str(out / "data/episode.json")], check=True)
    if a.sprites:
        for k in ("closed", "mid", "open", "blink"):
            shutil.copy(Path(a.sprites) / f"{k}.webp", out / f"img/sprites/guest/{k}.webp")
    if a.cv_image:
        subprocess.run([sys.executable, str(HERE / "sprite.py"), "cv", a.cv_image, "--out", str(out / "img/hero")], check=True)
    missed = apply_patches(out, me, persona)
    if tmp: shutil.rmtree(tmp, ignore_errors=True)

    log(f"\nwrote {out}")
    if missed:
        log("\nPATCHES THAT DIDN'T APPLY. Either that feature isn't in this engine version (fine), or the code moved: grep for it and do it by hand:")
        for m in missed: log("  - " + m)
    hits = leftovers(out)
    if hits:
        log("\nLEFTOVERS: text about Sameep / Wispr still in the copy. Rewrite or remove each before publishing:")
        for f, lines in sorted(hits.items()):
            log(f"  {f}  ({len(lines)})")
            for i, t in lines[:4]: log(f"      {i}: {t}")
    else:
        log("no leftovers")
    if not all((out / f"img/sprites/guest/{k}.webp").exists() for k in ("closed", "mid", "open", "blink")):
        log("\nnext: make the guest sprite: python3 sprite.py frames <photo> --out " + str(out / "img/sprites/guest"))


if __name__ == "__main__":
    main()
