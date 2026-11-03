#!/usr/bin/env python3
"""check_episode.py <episode.json> [--site DIR]: the graph rules. Exit 1 on any error.

Checks: every choice/next target exists; no node is a dead end; every node is reachable from start;
line ids unique and lowercase; every `who` is a speaker (or host/guest); chapters/route point at real
nodes; text has no placeholders; lines are spoken length (warns over 60 words). With --site, also
that every line's audio file exists (after the voice step).
"""
import json, re, sys
from pathlib import Path

args = sys.argv[1:]
if not args: sys.exit(__doc__)
ep = json.loads(Path(args[0]).read_text())
site = Path(args[args.index("--site") + 1]) if "--site" in args else None
N, err, warn = ep.get("nodes", {}), [], []
if ep.get("start") not in N: err.append(f"start '{ep.get('start')}' isn't a node")
spk = set(ep.get("speakers", {})) | {"host", "guest"}
ids = set()
for nid, n in N.items():
    tg = [c.get("to") for c in n.get("choices", [])] + ([n["next"]] if n.get("next") else [])
    for t in tg:
        if t not in N: err.append(f"{nid}: goes to missing node '{t}'")
    if not tg: err.append(f"{nid}: dead end (no choices, no next)")
    for c in n.get("choices", []):
        if not c.get("label"): err.append(f"{nid}: a choice has no label")
        if not c.get("say"): warn.append(f"{nid}: choice '{c.get('label')}' has no `say` words")
    if not n.get("lines"): err.append(f"{nid}: no lines")
    for l in n.get("lines", []):
        i = l.get("id", "")
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", i): err.append(f"{nid}: bad line id '{i}'")
        if i in ids: err.append(f"duplicate line id {i}")
        ids.add(i)
        if l.get("who") not in spk: err.append(f"{i}: who '{l.get('who')}' isn't a speaker")
        t = l.get("text", "")
        if not t.strip() or "{{" in t or "TODO" in t: err.append(f"{i}: empty or placeholder text")
        if len(t.split()) > 60: warn.append(f"{i}: {len(t.split())} words (keep spoken lines under ~45)")
        if not l.get("audio"): err.append(f"{i}: no audio path")
        alts = [(f"{i}@{h}", o.get("audio")) for h, o in (l.get("h") or {}).items()]
        if site:
            for k, a in [(i, l.get("audio"))] + alts:
                if a and not (site / a).exists(): err.append(f"{k}: missing audio {a}")
        d = l.get("demo") or {}
        if d and not re.match(r"https?://|[a-z0-9]", str(d.get("url") or d.get("src") or "")): err.append(f"{i}: demo url looks wrong")
seen, todo = set(), [ep.get("start")]
while todo:
    x = todo.pop()
    if x in seen or x not in N: continue
    seen.add(x)
    todo += [c.get("to") for c in N[x].get("choices", [])] + ([N[x]["next"]] if N[x].get("next") else [])
for nid in N:
    if nid not in seen: err.append(f"{nid}: unreachable from start")
for c in ep.get("chapters", []):
    if c.get("to") not in N: err.append(f"chapter '{c.get('label')}' points at missing '{c.get('to')}'")
for r in [ep.get("route") or {}] + list((ep.get("routes") or {}).values()):
    for s in r.get("stops", []):
        if s not in N: err.append(f"route stop '{s}' missing")
for w in warn: print("warn:", w)
for e in err: print("ERROR:", e)
print(f"{len(N)} nodes, {len(ids)} lines: " + ("OK" if not err else f"{len(err)} errors"))
sys.exit(1 if err else 0)
