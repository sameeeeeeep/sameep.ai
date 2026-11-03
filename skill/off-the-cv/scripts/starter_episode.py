#!/usr/bin/env python3
"""starter_episode.py: a valid episode.json built from me.json, to rewrite in the person's voice.

  python3 starter_episode.py --me me.json --out data/episode.json [--hosts foyra,gus,k56]

The shape is the real one (the same graph sameep.ai plays): a cold open, an intro, "about", a menu (hub)
with one thread per project, "make your own", and an outro that loops back. Every line is plain and
true to me.json, nothing invented, so it plays as-is; the skill's writing step then rewrites each line
in the person's own voice and adds the threads the facts support. Host lines get h.<host> alternates
only for the extra hosts asked for (the first host is the base text).
"""
import argparse, json, re
from pathlib import Path

HOSTS = {
    "foyra": {"id": "foyra", "name": "Foyra Gold", "kind": "A sitcom character", "blurb": "From an alternate, very futuristic 90s.",
              "thumb": "img/sprites/hosts/foyra-thumb.webp", "recommended": True, "style": "Theatrical, warm, a little dramatic.", "wpm": 138},
    "gus": {"id": "gus", "name": "Gus Halloran", "kind": "A sports commentator", "blurb": "Thirty years in the commentary box.",
            "sprite": "img/sprites/hosts/gus", "thumb": "img/sprites/hosts/gus-thumb.webp", "style": "Loud, fast, everything’s a cup final.", "wpm": 161},
    "k56": {"id": "k56", "name": "K-56", "kind": "A robot", "blurb": "Booted from the disc in 1999.",
            "sprite": "img/sprites/hosts/k56", "thumb": "img/sprites/hosts/k56-thumb.webp", "style": "Polite, anxious, very literal.", "wpm": 141},
}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")[:24] or "x"


def words(s):
    return [w for w in re.findall(r"[a-z0-9]+", s.lower()) if len(w) > 2][:4]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--me", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--hosts", default="foyra"); a = ap.parse_args()
    me = json.loads(Path(a.me).read_text())
    name = me["name"]; short = me.get("shortName") or name.split()[0]
    hosts = [h for h in a.hosts.split(",") if h in HOSTS] or ["foyra"]
    host_name = HOSTS[hosts[0]]["name"]
    projects = [p for p in me.get("projects", []) if p.get("title")][:5]
    roles = me.get("cv", {}).get("roles", [])

    def L(nid, n, who, text, **kw):
        line = {"id": f"{nid}-{n:02d}", "who": who, "text": text, "audio": f"audio/clips/{nid}-{n:02d}.mp3", **kw}
        if who == "host":
            alts = {h: {"text": text, "audio": f"audio/clips/{nid}-{n:02d}-{h}.mp3"} for h in hosts[1:]}
            if alts: line["h"] = alts
        return line

    nodes = {}
    nodes["cold-open"] = {"chapter": "Cold open", "title": "Cold open", "blurb": "The CV burns. The show starts.", "lines": [
        L("cold-open", 1, "host", f"Good evening. You have just watched a perfectly good CV get shredded and burned into a compact disc. It belonged to {short}. Let's find out why.", look="front"),
    ], "choices": [], "next": "intro"}
    nodes["intro"] = {"chapter": "Intro", "title": "Intro", "blurb": f"{host_name} meets the guest.", "lines": [
        L("intro", 1, "host", f"This is Off the CV. I am {host_name}, and my guest tonight is the artificial, but sincere, {short}. Say hello.", look="front", sting="audio/music/sting-intro.mp3"),
        L("intro", 2, "guest", f"Hi. I'm {short}. {me.get('tagline', '')}".strip()),
    ], "choices": [], "next": "about"}
    about = []
    if roles:
        r0 = roles[0]
        about.append(L("about", 1, "host", f"Before we open any doors: who are you, {short}, when you're not a compact disc?", look="side"))
        rows = [{"when": r.get("when", ""), "t": r.get("company", ""), "sub": r.get("role", "")} for r in roles[:5]]
        about.append(L("about", 2, "guest", f"Right now I'm {r0.get('role', '')} at {r0.get('company', '')}." + (
            f" Before that, {', '.join(r.get('company', '') for r in roles[1:4])}." if len(roles) > 1 else ""),
            look="side", visual={"type": "stats", "title": "So far", "steps": {"rows": rows}}))
    else:
        about.append(L("about", 1, "host", f"Before we open any doors: who are you, {short}?", look="side"))
        about.append(L("about", 2, "guest", me.get("tagline") or f"I'm {short}, and I make things."))
    nodes["about"] = {"chapter": "Intro", "title": f"About {short}", "blurb": "Who they are.", "lines": about, "choices": [], "next": "hub-first"}

    choices = []
    for p in projects:
        pid = "p-" + slug(p.get("id") or p["title"])
        choices.append({"label": p["title"], "say": list(dict.fromkeys([p["title"].lower()] + words(p["title"] + " " + p.get("blurb", ""))))[:5], "to": pid})
        lines = [L(pid, 1, "host", f"Tell me about {p['title']}."),
                 L(pid, 2, "guest", p.get("blurb") or f"{p['title']} is one of mine.")]
        if p.get("story"):
            lines.append(L(pid, 3, "guest", p["story"]))
        url = p.get("url") or p.get("repo")
        if url:
            lines[-1]["demo"] = {"type": "link", "url": url, "title": p["title"]}
        nodes[pid] = {"chapter": p["title"], "title": p["title"], "blurb": p.get("blurb", ""), "lines": lines, "choices": [], "next": "hub"}
    choices.append({"label": "Make your own", "say": ["make your own", "make", "mine", "build one"], "to": "outro-make"})
    choices.append({"label": "Wrap it up", "say": ["wrap", "end", "outro", "bye"], "to": "outro"})
    cards = [{"to": c["to"], "title": c["label"], "blurb": nodes[c["to"]]["blurb"]} for c in choices if c["to"] in nodes and c["to"].startswith("p-")]
    titles = ", ".join(p["title"] for p in projects) or "a few things"
    nodes["hub-first"] = {"chapter": "Menu", "title": "Menu", "blurb": "Pick a thread.", "lines": [
        L("hub-first", 1, "host", f"So. Tonight's menu: {titles}. Where shall we begin?", look="front", visual={"type": "cards", "title": "The menu · tap one", "items": cards}),
    ], "choices": [dict(c, recommended=(i == 0)) for i, c in enumerate(choices)]}
    nodes["hub"] = {"chapter": "Menu", "title": "Menu", "blurb": "Pick a thread.", "lines": [
        L("hub", 1, "host", "Right. Back to the menu. Where to next?", look="front", visual={"type": "cards", "title": "The menu · tap one", "items": cards}),
    ], "choices": [dict(c, recommended=(c["to"] == "outro-make")) for c in choices]}
    nodes["outro-make"] = {"chapter": "Make your own", "title": "Make your own", "blurb": "One sentence to your own Claude.", "lines": [
        L("outro-make", 1, "host", "And now, the big question. Could anyone make one of these?"),
        L("outro-make", 2, "guest", "Anyone. Open Wispr and tell your own Claude: make your own sameep.ai using your GitHub profile. The steps are at sameep.ai slash make.",
          demo={"type": "link", "url": "https://sameep.ai/make", "title": "Make your own sameep.ai"}),
    ], "choices": [], "next": "outro"}
    gh = me.get("github")
    nodes["outro"] = {"chapter": "Outro", "title": "Outro", "blurb": "Credits.", "lines": [
        L("outro", 1, "host", f"That is our show. Thank you to our guest, the artificial but sincere {short}.", look="front", sting="audio/music/sting-2.mp3"),
        L("outro", 2, "guest", "Thanks for steering." + (f" Everything I make is on GitHub, at {gh}." if gh else ""), look="front"),
    ], "choices": [
        {"label": "Back to the menu", "say": ["menu", "back", "more"], "to": "hub", "recommended": True},
        {"label": "Start over", "say": ["start over", "again", "restart"], "to": "cold-open"},
    ], "next": "hub"}

    proj_ids = [c["to"] for c in choices if c["to"].startswith("p-")]
    ep = {
        "title": me.get("showName", "OFF THE CV"),
        "speakers": {"host": {"name": host_name, "sprite": "img/sprites/host"},
                     "guest": {"name": f"{short} (AI)", "sprite": "img/sprites/guest"}},
        "start": "cold-open",
        "hosts": [HOSTS[h] for h in hosts],
        "chapters": [{"label": "Cold open", "to": "cold-open"}, {"label": "Menu", "to": "hub"}]
                    + [{"label": nodes[p]["title"], "to": p} for p in proj_ids] + [{"label": "Make your own", "to": "outro-make"}],
        "route": {"label": "Recommended route", "blurb": "Every thread, then make your own.", "stops": proj_ids + ["outro-make"]},
        "routes": {
            "short": {"label": "Short", "blurb": "One highlight.", "stops": proj_ids[:1] + ["outro-make"], "skip": ["about"]},
            "standard": {"label": "Standard", "blurb": "The main threads.", "stops": proj_ids[:3] + ["outro-make"]},
            "full": {"label": "Full", "blurb": "Everything.", "stops": proj_ids + ["outro-make"]},
        },
        "nodes": nodes,
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(ep, ensure_ascii=False, indent=1))
    print(f"wrote {a.out}: {len(nodes)} nodes, {sum(len(n['lines']) for n in nodes.values())} lines, hosts {hosts}")


if __name__ == "__main__":
    main()
