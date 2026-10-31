# OFF THE CV

**Wispr said no CVs. So I burned mine into a CD.**

Live at **[sameep.ai](https://sameep.ai)**. Scroll through 2,000 applications, watch one CV get folded,
crumpled, shredded and burned, and catch the CD that forms out of the embers. It slides into a Bondi-blue
iMac, dials up at 56k, and boots a podcast about my work. The host asks, my AI avatar answers in my
cloned voice, and you steer: say a thread out loud (with your own Wispr Flow, or the mic) or click it.

## The meta story

I didn't type this. The concept, the script and most of the build instructions were dictated with
**Wispr Flow**, rambling, out loud, the way you'd explain your work to a friend. The avatar talks the same
way, and the subtitles show it: each line arrives as raw dictation and cleans itself up on screen, the
way Flow does. The podcast is drawn from those dictations. The build was done with Claude Code, with a
few agents working in parallel off one plan.

## How it works

Plain HTML, CSS and ES modules. No framework, no build step, no server. GitHub Pages serves it.

```
index.html          the shell: the hero scroll story, then the app inside the iMac
js/hero/            the scroll-scrubbed beats (pile, envelope, origami, shred, burn, CD)
js/app/             CRT, boot, dial-up, Mac OS 8 desktop, the podcast player
persona.json        who the episode is about (swap it with ?persona=)
data/episode.json   the dialogue graph: nodes, lines, choices, `say` keywords, demos
audio/  img/        clips, stings, sprites, the iMac
make/               "Make your own": the in-browser builder
skill/off-the-cv/   the same thing as a Claude Code skill
```

The player is data-driven. Everything person-specific comes from a **bundle**:

```
persona.json                         {name, tagline, sprites, host, episodeUrl, links}
episode.json                         the graph (host / guest lines, choices, demos)
sprites/guest/{closed,mid,open,blink}.webp
audio/clips/<line-id>.mp3
```

Load anyone's bundle with `https://sameep.ai/?persona=<url-to-persona.json>`. Relative paths resolve
against that URL. A sample lives at [`make/sample/`](make/sample/):
[sameep.ai/?persona=make/sample/persona.json](https://sameep.ai/?persona=make/sample/persona.json&skip).

## Make your own

**With Switchboard (in the browser).** [Switchboard](https://thelastprompt.ai/switchboard) is a free Mac
app that lends your own Claude, and your local voice engine, to web pages, with a consent per site.
Open **[sameep.ai/make](https://sameep.ai/make/)**:

1. Connect: one consent in Switchboard (`claude_connect`).
2. Context: your public GitHub repos, a bio, links, or a context you saved in Switchboard.
3. Write: your Claude writes `persona.json` + `episode.json` (`claude_complete`), checked for dead ends.
4. Avatar: drop a photo, and the page makes the 4 lip-sync frames as a duotone, in the tab.
5. Voice: record 60 seconds. Switchboard's on-device engine (Pocket TTS on MLX) clones it, and every line
   is rendered locally. No cloud, no credits.
6. Preview instantly, then download the zip.

What's real and what's handed off, honestly:

| Step | How |
|---|---|
| Connect, write, read links, save a draft | Real Switchboard methods: `claude_connect`, `claude_complete` (agentic with `WebFetch` when you give links), `claude_context`, `claude_storage` |
| Speak lines | Real: `claude_speak` (on-device) |
| Clone a voice | Not a `window.claude` method. Like Switchboard's own Clone wrapp, the page calls the local engine at `127.0.0.1:7897` directly; if your browser blocks that, the skill does it |
| Illustrated avatar frames | Not lent to pages. The page makes a duotone set; the skill uses your own image tool |

**With Claude Code (from your machine).** Install the skill and run `/off-the-cv`:

```sh
mkdir -p ~/.claude/skills/off-the-cv
curl -fsSL https://sameep.ai/skill/off-the-cv/SKILL.md -o ~/.claude/skills/off-the-cv/SKILL.md
```

It reads your repos and notes, writes the bundle, makes the frames, clones your voice with Switchboard's
local engine (or ElevenLabs / Fish Audio with your own key, never stored), renders the clips, previews,
scans for private data, and with your yes forks this repo and turns on GitHub Pages.

**Publishing by hand.** Fork this repo, unzip your bundle into `me/`, enable Pages from `main` (root), and
share `https://<you>.github.io/sameep.ai/?persona=me/persona.json`. Delete `CNAME` in your fork.

## Credits

- Built by Sameep Rehlan, dictated with [Wispr Flow](https://wisprflow.ai), built with Claude Code.
- [Switchboard](https://github.com/sameeeeeeep/switchboard): your own Claude in any page (`window.claude`), plus the on-device voice engine.
- Voice cloning: [Kyutai Pocket TTS](https://huggingface.co/kyutai/pocket-tts), via `pocket-tts-mlx` on Apple Silicon.
- [three.js](https://threejs.org) (MIT), [JSZip](https://stuk.github.io/jszip/) (MIT or GPLv3, used under MIT), [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).
- Type: Doto, Bricolage Grotesque, Spline Sans Mono, VT323 and Patrick Hand from Google Fonts (SIL OFL).
- The live desktop wallpaper is [wallpap.live](https://wallpap.live).
- All images and sounds were made for this project. The host is an invented character with a synthetic voice.

## License

Code: [MIT](LICENSE). My face, voice and words in this repo are mine. Fork the code and make your own.
