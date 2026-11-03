#!/usr/bin/env python3
"""Measures every clip with ffprobe and writes site/data/durations.json.

Durations are for the DEFAULT version (line.v.default.audio overrides, lines
with only:"wispr" skipped). Node time = clip lengths + the player's own gaps
(280 ms between lines, a 480 ms "thinking" beat before each host line).

  nodes[id]      {sec, lines}
  chapters[to]   {route: [ids], routeSec, allSec, nodes: [ids]}  per ep.chapters entry
  route          {stops, path: [ids], sec}                       the recommended route
Run: OTCV_SITE=path/to/site python3 durations.py   (re-run after any audio change)
"""
import hashlib, json
import subprocess
from pathlib import Path

import os
SITE = Path(os.environ.get("OTCV_SITE", ".")).resolve()  # the site folder (default: the current directory)
VERSION = "default"
GAP, THINK, NEXT = 0.28, 0.48, 0.9

_cache = {}


def probe(rel):
    if not rel:
        return None
    if rel in _cache:
        return _cache[rel]
    f = SITE / rel
    d = None
    if f.exists():
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                             capture_output=True, text=True).stdout.strip()
        try:
            d = float(out)
        except ValueError:
            d = None
    _cache[rel] = d
    return d


def line_sec(line):
    o = (line.get("v") or {}).get(VERSION) or {}
    audio = o.get("audio", line.get("audio"))
    d = probe(audio)
    if d is None:  # same estimate the player uses when audio is missing
        words = len((o.get("text", line.get("text")) or "").split())
        d = max(2.4, words * 0.36 + 0.7)
    return d


def node_sec(node):
    lines = [l for l in node.get("lines", []) if not l.get("only") or l["only"] == VERSION]
    if not lines:
        return 0.0, 0
    s = sum(line_sec(l) for l in lines) + GAP * (len(lines) - 1) + THINK * sum(1 for l in lines if l["who"] == "host")
    return s, len(lines)


def is_hub(nid, node):
    return nid.endswith("-hub") or nid.endswith("-again") or nid in ("hub", "hub-first")


def main():
    ep = json.loads((SITE / "data/episode.json").read_text())
    N = ep["nodes"]
    nodes = {}
    for nid, node in N.items():
        s, n = node_sec(node)
        nodes[nid] = {"sec": round(s, 1), "lines": n}

    def rec_next(nid):
        node = N[nid]
        for c in node.get("choices", []):
            if c.get("recommended"):
                return c["to"]
        if not node.get("choices"):
            return node.get("next")
        return None

    chapters = {}
    for ch in ep.get("chapters", []):
        to = ch["to"]
        label = N[to].get("chapter")
        members = [k for k, v in N.items() if v.get("chapter") == label and not is_hub(k, v)] if not is_hub(to, N[to]) else [to]
        route, cur, seen = [], to, set()
        while cur and cur in N and cur not in seen and N[cur].get("chapter") == label:
            seen.add(cur)
            if not is_hub(cur, N[cur]) or cur == to:
                route.append(cur)
            cur = rec_next(cur)
        chapters[to] = {
            "label": ch["label"],
            "route": route,
            "routeSec": round(sum(nodes[k]["sec"] for k in route), 1),
            "allSec": round(sum(nodes[k]["sec"] for k in members), 1),
            "nodes": members,
        }

    # the recommended route: start -> ... visiting each stop, via the shortest choice/next path
    def edges(nid):
        node = N[nid]
        out = [c["to"] for c in node.get("choices", []) if not (c.get("demo") or {}).get("type") == "link"]
        if node.get("next"):
            out.append(node["next"])
        return out

    def shortest(a, b):
        prev, q = {a: None}, [a]
        while q:
            x = q.pop(0)
            if x == b:
                break
            for y in edges(x):
                if y in N and y not in prev:
                    prev[y] = x
                    q.append(y)
        path, x = [], b
        while x is not None:
            path.append(x)
            x = prev.get(x)
        return path[::-1]

    def route_of(R):
        path, cur = [], ep["start"]
        # the opening runs linearly until the first menu
        while cur and not N[cur].get("choices"):
            path.append(cur)
            cur = N[cur].get("next")
        for stop in R["stops"]:
            seg = shortest(cur, stop)
            path += seg[:-1] if path and seg and path[-1] == seg[0] else seg
            if not path or path[-1] != stop:
                path.append(stop)
            cur = stop
        while path and N[path[-1]].get("next") and not N[path[-1]].get("choices"):
            path.append(N[path[-1]]["next"])
            if path[-1] == "outro" or len(path) > 80:
                break
        dedup = []
        for p in path:
            if not dedup or dedup[-1] != p:
                dedup.append(p)
        # a route may skip linear nodes (the short one skips "about")
        dedup = [p for p in dedup if p not in R.get("skip", [])]
        return {"stops": R["stops"], "path": dedup, "sec": round(sum(nodes[k]["sec"] for k in dedup), 1)}

    route = route_of(ep.get("route") or {"stops": []})
    routes = {k: route_of(R) for k, R in (ep.get("routes") or {}).items()}

    total = round(sum(v["sec"] for v in nodes.values()), 1)
    out = {"version": VERSION, "_": "generated by build/script-tools/durations.py from ffprobe; do not hand-edit",
           "totalSec": total, "route": route, "routes": routes, "chapters": chapters, "nodes": nodes,
           # a short fingerprint per clip: the player adds it to the URL, so a re-voiced or trimmed clip is never
           # served from a browser's or Cloudflare's cache of the old one
           "v": {str(f.relative_to(SITE)): hashlib.md5(f.read_bytes()).hexdigest()[:7] for f in sorted((SITE / "audio/clips").rglob("*.mp3"))}}
    (SITE / "data/durations.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    for k, r in routes.items(): print(f"  route {k}: {r['sec']/60:.1f} min: {' > '.join(r['path'])}")
    print(f"total {total/60:.1f} min; route {route['sec']/60:.1f} min: {' > '.join(route['path'])}")
    for to, c in chapters.items():
        print(f"  {c['label'][:34]:34} route {c['routeSec']/60:4.1f}  all {c['allSec']/60:4.1f}  {c['route']}")


if __name__ == "__main__":
    main()
