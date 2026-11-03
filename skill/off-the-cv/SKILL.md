---
name: off-the-cv
description: Make someone their own sameep.ai, end to end - the CV that gets shredded and burned onto a CD, the late-90s iMac desktop, and "Off the CV", a choose-your-own-adventure pixel-art podcast about their work, in their own voice. Pulls projects from GitHub (or LinkedIn, or a list), makes their pixel guest sprite from a photo, writes the episode in their voice, clones or picks a voice and renders every line with a whisper check, makes lip-sync and subtitles, then builds and deploys to GitHub Pages or Cloudflare. Use for "make your own sameep.ai", "make my own sameep.ai using my GitHub profile", "/off-the-cv", "make me an off the cv", or "a podcast portfolio like sameep.ai".
---

# Make your own sameep.ai

You're building the person's own copy of https://sameep.ai: their CV gets shredded and burned onto a
CD, the CD boots a Bondi-blue iMac, and the iMac plays **Off the CV**, a podcast where a host
interviews a pixel-art version of them, in their voice, about their real work. Visitors steer it by
clicking or saying a thread out loud.

The engine is open source (MIT): https://github.com/sameeeeeeep/sameep.ai. Everything person-specific
goes in one config file, `me.json`, plus the episode script, the sprite and the clips. The scripts
next to this file do the mechanical parts; you do the judgement: what to include, the writing, the
checks with the person.

Scripts are in `scripts/` next to this file (call it `$SK`). All of them are python3 stdlib + Pillow,
plus ffmpeg and whisper-cli for the voice step.

## Before anything: ask once, up front

Send the person ONE message listing what you need, with the defaults, so nothing stalls halfway. Only
the first item is required.

1. **Their name**, and the GitHub username (if the request said "using my GitHub profile", you have it).
2. **Their CV**: a PDF, a doc, a LinkedIn profile export (LinkedIn → Settings → Data privacy → Get a copy
   of your data, or "Save to PDF" on their profile), or pasted text. Default: built from GitHub alone.
3. **Projects**: default = their public GitHub repos, top 4 to 6 by stars and recent activity. They can
   add or cut, add live URLs, and add a sentence of story for each ("why I made it", "what broke").
4. **A photo** for the pixel-art guest: face toward the camera, shoulders up. A LinkedIn profile photo
   is fine if they point you at it or save it for you. Default: a neutral silhouette (no face, the same
   for everyone). Tell them a photo looks far better.
5. **Voice**: a 20 to 60 second recording of them reading naturally, to clone on their own machine.
   Default: a preset voice that isn't a clone of anyone.
6. **How they talk**: a pasted voice memo transcript, a few messages, a blog post. Default: their CV and
   READMEs, written plainly.
7. **Where it goes**: GitHub Pages (default, needs `gh` logged in) or Cloudflare Pages (needs
   `wrangler` logged in), and an optional custom domain.
8. **Anything private**: things they don't want said (an employer, a number, a project).

Then check the machine (`python3 $SK/voice.py engines`; `gh auth status`; `which ffmpeg whisper-cli`)
and tell them what's missing and the one command that fixes it, before you start.

## Consent and privacy (non-negotiable)

- **Their own material only.** Use what they give you or point you at. Never invent employers, titles,
  numbers, awards, quotes, clients or users. If a fact isn't in the material, it isn't in the show.
- **Ask before reading anything private**: private repos, notes, docs, inboxes. Public repos are fine.
- **Their face, their voice, nobody else's.** Only use a photo of the person themselves and only clone
  their own voice, from a sample they recorded and gave you for this. Never clone or depict another
  real person. Hosts are fictional characters with preset voices.
- **Nothing private ships.** The site is public. No email, phone, home address, salary, client names
  they marked private, API keys, tokens or private URLs. The shredded CV is drawn from `me.json`, which
  has no contact details; if they supply a CV image, redact the contact block first.
- **Keys stay in the environment.** A voice-service key (e.g. `ELEVENLABS_API_KEY`) is read from the
  environment, never written into any file. Say which service a voice sample goes to before sending it.
- **Show, then ship.** Preview locally first. Publishing needs an explicit yes.
- When done, tell them where the voice clone lives and how to delete it.

## The steps

Work in a new folder (default `./my-sameep-ai/`): `in/` for what they give you, `site/` for the build.

### 1. Gather

```sh
python3 $SK/github_projects.py <username> --limit 8 --readme --out in/github.json
```

Read the READMEs for the story. From the CV, take roles (company, title, years) and one-line
outcomes that are written in it. Write `in/me.json` (schema: `template/me.example.json`): name,
shortName, tagline (their words, under 90 characters), github, links, `cv.headline`, `cv.roles` (up
to 6, newest first), `projects` (title, blurb, story, url, repo, folder: products / tools / fun /
growth). Show them the project list and the CV roles; cut and add until they say it's right.

### 2. Scaffold the site

```sh
python3 $SK/scaffold.py --me in/me.json --out site
```

It shallow-clones the engine, strips everything that's Sameep's, writes their persona, CV, desktop
folders and a starter `data/episode.json`, and switches off Sameep's analytics so their visitors'
data never goes to his server. Read its report: patch anchors that didn't apply, and **leftovers** (text
about Sameep or Wispr still in the copy). Fix every visible leftover by hand. Dead code paths (the
Wispr style guide, Growth OS) can stay, but nothing a visitor can see may name Sameep as the subject.

### 3. Write the episode in their voice

Rewrite `site/data/episode.json`, starting from the starter. Rules:

- **Their voice**: first person, plain words, short spoken sentences, a little rambling honesty. Read
  their memo/messages and match the rhythm. Under ~40 words a line. A `messy` field per guest line
  holds the raw, dictated version (ums, restarts); subtitles show it first, then clean up.
- **The host is a character** (Foyra Gold by default: theatrical, warm, calls everyone "darling").
  The host asks; the guest answers short and leaves a thread hanging; the visitor pulls a thread.
- **Structure**: cold open → intro → about → menu (hub) → one thread per project (2 to 4 lines,
  each with a `demo` link to the real thing) → "make your own" → outro, which loops back to the menu.
  12 to 40 lines in all. 1 or 2 deep threads; the rest quick.
- **Only true things.** Every claim traces to the CV, a README or something they told you.
- Keep the `outro-make` node: it's how the next person finds this. Its guest line is the one sentence:
  "Open Wispr and tell your own Claude: make your own sameep.ai using your GitHub profile."

Schema (the real one the player reads):

```json
{
  "speakers": { "host": {"name": "Foyra Gold", "sprite": "img/sprites/host"}, "guest": {"name": "Ada (AI)", "sprite": "img/sprites/guest"} },
  "start": "cold-open",
  "hosts": [ {"id": "foyra", "name": "Foyra Gold", "...": "..."} ],
  "chapters": [ {"label": "Menu", "to": "hub"} ],
  "route": {"stops": ["p-tidy-csv", "outro-make"]},
  "routes": {"short": {"stops": []}, "standard": {"stops": []}, "full": {"stops": []}},
  "nodes": {
    "hub": {
      "chapter": "Menu", "title": "Menu", "blurb": "Pick a thread.",
      "lines": [ {"id": "hub-01", "who": "host", "text": "Where to next?", "audio": "audio/clips/hub-01.mp3",
                  "h": {"gus": {"text": "Where to next?!", "audio": "audio/clips/hub-01-gus.mp3"}}} ],
      "choices": [ {"label": "tidy-csv", "say": ["tidy", "csv", "spreadsheet"], "to": "p-tidy-csv", "recommended": true} ]
    },
    "p-tidy-csv": {
      "chapter": "tidy-csv", "title": "tidy-csv", "blurb": "Cleans messy CSV exports.",
      "lines": [ {"id": "p-tidy-csv-02", "who": "guest", "text": "…", "messy": "…", "audio": "audio/clips/p-tidy-csv-02.mp3",
                  "demo": {"type": "link", "url": "https://github.com/ada/tidy-csv", "title": "tidy-csv"}} ],
      "choices": [], "next": "hub"
    }
  }
}
```

- Line ids: lowercase, unique, `<node>-NN`. `who`: `host` or `guest`. Audio: `audio/clips/<id>.mp3`.
- `choices: []` plus `next` = auto-advance. `say`: 3 to 6 lowercase words a visitor might say.
- `demo.type`: `link | iframe | image | video | qr`, public URLs only. Optional per line: `look`
  (`front`/`side`), `shot` (`cu`), `sting` (`audio/music/sting-1.mp3`), `visual` (`stats`, `cards`).
- **Extra hosts** (Gus Halloran, a loud sports commentator; K-56, a polite, anxious robot): add them to
  `hosts` and give every host line an `h.<id>` alternate written in that host's voice. Without
  alternates, keep only Foyra.

Check it, then show them the outline and five sample lines before voicing anything:

```sh
python3 $SK/check_episode.py site/data/episode.json
```

### 4. Their pixel guest

```sh
python3 $SK/sprite.py frames in/photo.jpg --out site/img/sprites/guest     # from their photo
python3 $SK/sprite.py placeholder --out site/img/sprites/guest     # no photo: a neutral silhouette
python3 $SK/sprite.py preview site/img/sprites/guest --site site           # the 4 frames in the studio seat
```

On a Mac, `frames` uses Apple Vision on-device to cut them out and find the mouth and eyes; it then
pixelates, outlines and warms the cut-out and draws the mid / open / blink frames on the same grid. If it
can't find the face, pass `--mouth X,Y,W --eyes X1,Y1,X2,Y2` in photo pixels. **Better, if they have an
image model** (an image-generation MCP or app): generate one portrait from their photo in the studio's
pixel-art style, framed like `site/img/sprites/host/closed.webp` (seated behind a desk, facing left
towards the host, transparent background, 607x536), then `sprite.py frames that.png --px 1 --no-cutout`
to add the mouth and blink frames. Look at `preview.png`; redo if the face is cropped or the mouth
marks sit off the lips.

### 5. Voice

```sh
python3 $SK/voice.py engines                          # what this machine has
python3 $SK/voice.py clone in/sample.wav --name me    # their clone, on their Mac (local Pocket TTS)
python3 $SK/voice.py render --site site --who guest --voice me
python3 $SK/voice.py render --site site --who host  --voice moira
python3 $SK/voice.py render --site site --who host  --voice say:Reed --host k56    # per extra host
```

Engines, best first:

1. **Local Pocket TTS** at `127.0.0.1:7897` (comes with Switchboard, https://thelastprompt.ai/switchboard;
   runs on Apple silicon, nothing leaves the Mac). Cloning needs the gated `kyutai/pocket-tts` weights:
   the person runs `hf auth login` and accepts the model terms themselves. `moira` is the Foyra host preset.
2. **macOS voices** (`say:Samantha`, `say:Reed`, ...): no clone, always there.
3. **ElevenLabs** (`eleven:<voice_id>`), only if they choose it, with their own key in
   `ELEVENLABS_API_KEY`. Tell them the sample and the script go to ElevenLabs.

Recording a sample (after they say yes): `ffmpeg -f avfoundation -i ":0" -t 45 -ac 1 in/sample.wav`, reading
any paragraph at their normal pace in a quiet room.

**The whisper-check loop.** Every take is transcribed with whisper-cli and compared to the script; up to
4 takes, best kept. Lines printed `LOW` didn't match: listen, then respell the word that went wrong in
`site/data/pron.json` (`[["\\bKubernetes\\b", "koo-ber-net-eez"]]`) or reword the line, and re-render
with `--only <id> --force`. Listen to three random guest clips yourself (or have them) before moving on.

### 6. Lip-sync, subtitles, timings

```sh
cd site
OTCV_SITE=. python3 $SK/visemes.py     # data/visemes.json: mouth shapes per clip
OTCV_SITE=. python3 $SK/words.py       # data/words.json: word timings for the karaoke subtitles
OTCV_SITE=. python3 $SK/durations.py   # data/durations.json: chapter and route lengths
python3 $SK/check_episode.py data/episode.json --site .
```

Re-run all three after any audio change.

### 7. Preview

`python3 -m http.server 8080 --directory site`, then open `http://localhost:8080/` (the whole
thing: scroll the CV, burn it, boot the iMac) and `http://localhost:8080/?skip` (straight to the
desktop). Click every thread once. Check a phone width (375 px). Fix dead ends or missing clips.

### 8. Privacy scan, then publish (explicit yes first)

```sh
sh $SK/privacy_scan.sh site      # prints hits, or "clean"
```

**GitHub Pages**:

```sh
cd site && git init -b main && git add -A && git commit -m "My own Off the CV"
gh repo create <user>/<user>.github.io --public --source . --push     # or any repo name
gh api -X POST repos/<user>/<repo>/pages -f "source[branch]=main" -f "source[path]=/"
```

Live at `https://<user>.github.io/` (or `/<repo>/`). For a custom domain, add `domain` to me.json
(scaffold writes `CNAME`) and point the DNS at GitHub.

**Cloudflare Pages**: `npx wrangler pages deploy site --project-name <name>` (live at
`https://<name>.pages.dev`).

Keep the engine's `LICENSE` (MIT) in the published site.

### 9. Hand-over

Tell them: the URL; what you made (episode length from `data/durations.json`, number of lines);
where the voice clone lives (`~/.relay/voices/<name>.wav` for the local engine) and how to delete it;
and that editing `data/episode.json`, then re-running steps 5 and 6, updates the show.

## Files

```
SKILL.md                       this
scripts/scaffold.py            engine + me.json → their site (strips Sameep's content, patches the CV/desktop)
scripts/starter_episode.py     me.json → a valid starter episode
scripts/check_episode.py       the graph rules (dead ends, reachability, ids, audio)
scripts/github_projects.py     public repos → projects
scripts/sprite.py, face.swift  photo → pixel guest frames (Vision cut-out on a Mac), neutral silhouette, CV image, preview
scripts/voice.py               clone + render with the whisper check (Pocket TTS, macOS say, ElevenLabs)
scripts/visemes.py, words.py, durations.py   lip-sync, karaoke subtitles, timings
scripts/privacy_scan.sh        what must never ship
template/me.example.json       the one config file
template/episode.example.json  a whole example episode
```

Install in Claude Code: `curl -fsSL https://sameep.ai/skill/off-the-cv/install.sh | sh` (installs to
`~/.claude/skills/off-the-cv/`), then say "make your own sameep.ai using my GitHub profile".
