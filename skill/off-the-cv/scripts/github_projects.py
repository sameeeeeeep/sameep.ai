#!/usr/bin/env python3
"""github_projects.py <username> [--limit 8] [--readme] [--out projects.json]

Public repos only, through the public GitHub API (no token; set GITHUB_TOKEN to lift the rate limit).
Skips forks, archived and empty repos; ranks by stars, then recent pushes. Prints me.json-ready
`projects` entries: {title, blurb, url, repo, folder, stars, language, pushed, readme?}. `blurb` is the
repo's own description (never invented); with --readme the first ~1200 chars of the README are added
so the writer can find the story. Review the list with the person before using it.
"""
import argparse, base64, json, os, urllib.request

ap = argparse.ArgumentParser(); ap.add_argument("user"); ap.add_argument("--limit", type=int, default=8)
ap.add_argument("--readme", action="store_true"); ap.add_argument("--out"); a = ap.parse_args()
H = {"Accept": "application/vnd.github+json", "User-Agent": "off-the-cv-skill"}
if os.environ.get("GITHUB_TOKEN"): H["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]

def get(url):
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=30).read())

user = get(f"https://api.github.com/users/{a.user}")
repos = get(f"https://api.github.com/users/{a.user}/repos?per_page=100&sort=pushed&type=owner")
repos = [r for r in repos if not r["fork"] and not r["archived"] and not r.get("private") and r.get("size", 0) > 0 and r["name"] != f"{a.user}.github.io"]
repos.sort(key=lambda r: (r["stargazers_count"], r["pushed_at"]), reverse=True)
out = []
for r in repos[: a.limit]:
    p = {"title": r["name"], "blurb": (r.get("description") or "").strip(), "url": r.get("homepage") or r["html_url"],
         "repo": r["html_url"], "folder": "products", "stars": r["stargazers_count"], "language": r.get("language"), "pushed": r["pushed_at"][:10]}
    if a.readme:
        try:
            d = get(f"https://api.github.com/repos/{a.user}/{r['name']}/readme")
            p["readme"] = base64.b64decode(d["content"]).decode("utf-8", "ignore")[:1200]
        except Exception:
            pass
    out.append(p)
res = {"profile": {"name": user.get("name"), "login": user["login"], "bio": user.get("bio"), "blog": user.get("blog"),
                   "avatar": user.get("avatar_url"), "location": user.get("location")}, "projects": out}
s = json.dumps(res, indent=2, ensure_ascii=False)
if a.out: open(a.out, "w").write(s)
print(s)
