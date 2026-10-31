---
name: off-the-cv
description: Build your own "OFF THE CV", an interactive talk-to-it podcast portfolio (the format behind sameep.ai), from your own machine. Reads your repos and notes, writes persona.json + episode.json, makes 4 lip-sync avatar frames from a photo, clones your voice locally with Switchboard's on-device engine (or ElevenLabs/Fish with your own key), renders every line, and deploys to GitHub Pages. Use for "/off-the-cv", "make my own off the cv", "make my podcast portfolio", or "make a sameep.ai-style portfolio for me".
---

# OFF THE CV: make your own

You are building the user's own OFF THE CV bundle: a podcast in which a host asks questions, the user's
avatar answers in the user's own cloned voice, and visitors steer by saying or clicking choices. The
player is open source (MIT) at https://github.com/sameeeeeeep/sameep.ai and loads any bundle with
`?persona=<url-to-persona.json>`.

Work in a new folder, `./offthecv/` in the current directory unless the user names one. Do one phase at
a time, tell the user what you are about to do before anything that reads private material, records,
uploads or publishes, and wait for a yes on those.

## The connect checklist (read this first, every time)

This is what your Claude, or the user's Switchboard, should hold the moment it connects:

1. **Only their material.** Use only what the user gives you or points you at: repos, notes, a bio,
   links. Never invent employers, numbers, awards, quotes or clients. If a fact isn't in the material,
   leave it out.
2. **Ask before reading private things.** Public repos are fine. Private repos, notes folders and docs
   need a yes and a path.
3. **Their voice.** First person, plain words, short spoken sentences, a little rambling honesty.
   Each line is 1 to 3 sentences, under 40 words.
4. **The loop.** Host asks. The guest gives a short answer that deliberately leaves threads hanging.
   Choices let the visitor pull a thread. The thread's node is the deep answer. Repeat.
5. **No dead ends.** Every node has `choices` or `next`. Every node is reachable from `start`. The
   last node offers "Start over".
6. **Privacy.** The bundle is going to be public. No email, phone, home address, salary, API keys,
   tokens, private URLs, or anything the user marks private. Run the scan in phase 6.
7. **Consent for voice and face.** Only clone the user's own voice and only use their own photo.
   Never clone or depict another real person. The host voice is a synthetic preset, never a clone of
   a real person.
8. **Show, then ship.** Preview locally before anything is published. Publishing needs an explicit yes.

## Bundle layout (what you produce)

```
offthecv/
  persona.json
  episode.json
  sprites/guest/{closed,mid,open,blink}.webp      512x640, same framing in all four
  audio/clips/<line-id>.mp3                       mono, 64-96 kbps
```

`persona.json`:

```json
{
  "name": "Their Name",
  "tagline": "One line, under 90 characters",
  "sprites": "sprites/guest",
  "host": { "name": "An invented host name" },
  "episodeUrl": "episode.json",
  "links": [ { "label": "GitHub", "url": "https://github.com/them" } ]
}
```

`sprites` may also be an object `{ "closed": url, "mid": url, "open": url, "blink": url }`. Relative
URLs resolve against persona.json. Leave `host.sprite` out to use the site's default host.

`episode.json` (the player's dialogue graph):

```json
{
  "speakers": {
    "host":  { "name": "An invented host name" },
    "guest": { "name": "Their Name (AI)", "sprite": "sprites/guest" }
  },
  "start": "intro",
  "nodes": {
    "intro": {
      "chapter": "Cold open",
      "lines": [
        { "id": "intro-01", "who": "host", "text": "…", "audio": "audio/clips/intro-01.mp3" },
        { "id": "intro-02", "who": "guest", "text": "…", "messy": "optional rawer dictated version", "audio": "audio/clips/intro-02.mp3" }
      ],
      "choices": [ { "label": "Tell me about X", "say": ["x", "keyword"], "to": "x" } ]
    },
    "x": {
      "chapter": "X",
      "lines": [ { "id": "x-01", "who": "guest", "text": "…", "demo": { "type": "iframe", "url": "https://…", "title": "…" } } ],
      "choices": [],
      "next": "outro"
    }
  }
}
```

Rules: line ids are lowercase, unique, `<node>-NN`. `who` is `host` or `guest`. 12 to 30 lines total.
`demo.type` is one of `iframe | qr | image | video | link`, with a public URL only. `say` holds 3 to 6
lowercase words a visitor might speak. `choices: []` means auto-advance to `next`.

## Phase 1: gather context

- Ask for: GitHub username, a bio or notes (a pasted voice-memo transcript is ideal), links, and
  whether there are private repos or a notes folder they want included.
- Public repos: `gh repo list <user> --limit 50 --json name,description,stargazerCount,homepageUrl,primaryLanguage,isFork,isPrivate`
  (or the GitHub API without a token). Skip forks. Read the README of the top 6 to 10 by stars and recency.
- If Switchboard is installed, the user may have a draft from https://sameep.ai/make/ saved in that
  site's Switchboard storage as `offthecv-draft`. Ask them to paste it, or export it from the panel;
  don't go digging in `~/.relay`.
- Write a short `offthecv/notes.md` of the threads you found (4 to 7) and show it to the user. Let them
  cut or add before writing.

## Phase 2: write persona.json + episode.json

- Draft following the connect checklist and the schema above. 1 or 2 deep dives; the rest quick asides.
- Validate before showing it:
  - every `choices[].to` and `next` exists;
  - no node without choices and without next;
  - everything is reachable from `start`;
  - ids are unique; every `who` is a key in `speakers`.
- Show the user the outline (chapters and choices) and 3 sample lines. Revise until they are happy.

## Phase 3: avatar frames

Ask for one photo of the user: face toward the camera, shoulders up. Then pick the best available route:

1. **Their image tool** (an image-generation MCP or app they already have, e.g. one connected to Claude
   Code): generate one stylised portrait from the photo in a late-90s retro-futurist look (soft
   studio light, translucent-plastic palette: Bondi #0a8fa8, tangerine #ff8a1f, strawberry #ff4f7b),
   then make the other three frames by editing only the mouth (slightly open, open) and the eyes
   (closed). Keep framing, pose and lighting identical across all four; check by flipping them in
   sequence.
2. **No image tool:** the browser maker at https://sameep.ai/make/ makes a duotone set from the
   photo locally in the tab (step 3) and includes it in its zip. Or do the same here with Python
   (Pillow): cover-crop to 512x640, map luminance onto night #0f0d0b, a flavour colour and paper #f3eee2,
   then draw the mid/open mouth as dark ellipses at the mouth point and the blink as skin-coloured lids
   with a dark lash line at the eye points. Ask the user to confirm the mouth and eye positions.

Save as `sprites/guest/{closed,mid,open,blink}.webp`.

## Phase 4: voice

Check what exists, in this order:

1. **Switchboard's local voice engine** (Pocket TTS on MLX, on-device, no cloud):
   `curl -s http://127.0.0.1:7897/health` and `curl -s http://127.0.0.1:7897/voices`.
   - If it isn't running but Switchboard is installed, the engine is installed on demand by Switchboard
     (Settings, voice). Cloning needs the gated `kyutai/pocket-tts` weights on Hugging Face: the user runs
     `hf auth login` and accepts the model terms themselves. Don't do the login for them.
   - If the user already has a clone of their own voice in the list, ask which one.
   - Otherwise get a sample: 20 to 60 seconds of the user reading naturally in a quiet room. They can record
     it at https://sameep.ai/make/ (step 4 downloads it), or with `ffmpeg -f avfoundation -i ":0" -t 60 -ac 1 sample.wav`
     after they say yes to recording.
   - Clone it (stays on the Mac):
     ```sh
     python3 - <<'PY'
     import base64, json, urllib.request
     b64 = base64.b64encode(open("sample.wav", "rb").read()).decode()
     req = urllib.request.Request("http://127.0.0.1:7897/save", method="POST",
         headers={"Content-Type": "application/json"},
         data=json.dumps({"name": "me", "audio_b64": b64, "start": 2, "duration": 18}).encode())
     print(urllib.request.urlopen(req, timeout=120).read().decode())
     PY
     ```
     Pocket clones best from a 6 to 20 second reference, so `start`/`duration` pick 18 clean seconds.
     The engine normalises it and stores `~/.relay/voices/<name>.wav`; `/voices` lists it from then on.
   - Render a line: `POST /speak` with `{"text": "...", "voice": "me", "steps": 6, "temp": 0.45}`; it returns WAV.
     Use the higher-fidelity settings (6 steps, temp 0.45) for the cloned guest voice; presets can use defaults.
2. **Fallback with the user's own key** (only if they choose it, and only with their key from their
   environment: never write a key into any file in the bundle or the repo):
   - ElevenLabs: Instant Voice Cloning via `POST https://api.elevenlabs.io/v1/voices/add` (multipart,
     `files=@sample.wav`, header `xi-api-key: $ELEVENLABS_API_KEY`), then
     `POST /v1/text-to-speech/<voice_id>` per line.
   - Fish Audio: create a voice model from the sample with their `FISH_API_KEY`, then synthesise each line
     with that reference id.
   Tell the user which service the audio goes to before sending it.
3. **Host voice:** a synthetic preset, never a clone of a real person. With the local engine, use a
   built-in preset such as `alba`; otherwise macOS `say -v Samantha`.

Render every line into `audio/clips/<id>.wav`, then transcode:
`ffmpeg -y -i <id>.wav -ac 1 -b:a 80k <id>.mp3`, set each line's `"audio": "audio/clips/<id>.mp3"`, and delete
the WAVs. Listen to 3 random guest clips; if one comes back in a default system voice, the engine was
cold: re-render it.

## Phase 5: preview

From the bundle's parent folder, run a static server, e.g. `python3 -m http.server 8080`. Then either:

- clone the player next to it (`gh repo clone sameeeeeeep/sameep.ai player`), copy the bundle to
  `player/me/`, serve `player/`, and open `http://127.0.0.1:8080/?persona=me/persona.json&skip`; or
- open `https://sameep.ai/?persona=<an https URL of your persona.json>` once it's hosted.

Click through every choice once. Fix any dead end or missing clip.

## Phase 6: privacy scan, then publish

Scan before publishing:
```sh
grep -RInE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|\+?[0-9][0-9 ()-]{8,}[0-9]|sk-[A-Za-z0-9]{20,}|xi-api-key|api[_-]?key|BEGIN [A-Z ]*PRIVATE KEY' offthecv/ || echo clean
```
Show the user any hits and fix them.

Publish only after an explicit yes:
1. `gh repo fork sameeeeeeep/sameep.ai --clone --remote` (MIT; keep the LICENSE).
2. Copy the bundle to `me/` in the fork. Optionally replace the root `persona.json` with a copy that
   points at `me/` so the fork's homepage plays their episode. Remove the root `CNAME` (it's
   sameep.ai's domain), or replace it with the user's own domain.
3. Commit, push, and enable Pages from `main`, root:
   `gh api -X POST repos/<user>/sameep.ai/pages -f "source[branch]=main" -f "source[path]=/"`.
4. Share `https://<user>.github.io/sameep.ai/?persona=me/persona.json`.

Finish by telling the user the URL, what was cloned where (the voice file lives in `~/.relay/voices/`),
and how to delete it if they want to.
