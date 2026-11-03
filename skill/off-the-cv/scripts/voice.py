#!/usr/bin/env python3
"""voice.py: clone the guest's voice and render every line, each take whisper-checked.

  python3 voice.py engines                                   what's available on this machine
  python3 voice.py clone sample.wav --name me [--start 2 --duration 18]     local Pocket TTS clone (stays on the Mac)
  python3 voice.py render --site DIR --who guest --voice me [--host gus] [--only REGEX] [--force]

Voices:
  <name>            a voice on the local Pocket TTS server (127.0.0.1:7897, Switchboard's on-device engine):
                    a clone made with `clone`, or a preset (e.g. moira for the Foyra host)
  say:<Voice>       a macOS system voice (e.g. say:Samantha, say:Reed). Deterministic; no cloning
  eleven:<voice_id> ElevenLabs, with the person's own key in $ELEVENLABS_API_KEY (never written to a file)

render: for every line spoken by --who (and, with --host, that host's h.<host> alternates), synthesise up
to 4 takes, transcribe each with whisper-cli, keep the best match (stop at >= 0.9), trim the silence,
loudnorm to -16 LUFS and write mono 72 kbps MP3 at <site>/<line.audio>. Unchanged lines are skipped
(audio/clips/.manifest.json). Lines that never matched well are printed as LOW: listen, reword or
respell them (pron.json next to episode.json: [["regex", "say it like this"], ...]) and re-run.
"""
import argparse, base64, difflib, hashlib, json, os, re, shutil, subprocess, sys, tempfile, urllib.request
from pathlib import Path

TTS = os.environ.get("OTCV_TTS", "http://127.0.0.1:7897")
WHISPER_MODELS = [os.environ.get("WHISPER_MODEL", ""), str(Path.home() / ".relay/models/ggml-base.en.bin"),
                  str(Path.home() / "Library/Application Support/Recordly/whisper/ggml-small.bin")]
PRON = [(r"\bsameep\.ai\b", "Sah-meep dot A I"), (r"\bWispr\b", "Whisper"), (r"\bOFF THE CV\b", "Off the C V"), (r"\bCVs\b", "C Vs"), (r"\bCV\b", "C V"),
        (r"\bCD\b", "C D"), (r"\bAPI\b", "A P I"), (r"\bAI\b", "A I"), (r"\bUI\b", "U I"), (r"\bHTML\b", "H T M L"), (r"\bCSS\b", "C S S"),
        (r"\bLLM\b", "L L M"), (r"\bGitHub\b", "Git Hub"), (r"\bSQL\b", "sequel"), (r"\bCLI\b", "C L I"), (r"\bSaaS\b", "sass"),
        (r"\bFoyra\b", "Foy-ra"), (r"\bK-56\b", "K fifty-six"), (r"\bQR\b", "Q R"), (r"\bOS\b", "O S"), (r"\bTTS\b", "T T S")]
AF = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,"
      "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,"
      "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100")


def get(url, data=None, timeout=600):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"} if data is not None else {})
    return urllib.request.urlopen(req, timeout=timeout).read()


def whisper_model():
    return next((m for m in WHISPER_MODELS if m and Path(m).exists()), None)


def engines():
    out = {}
    try: out["pocket"] = json.loads(get(TTS + "/voices", timeout=4)).get("voices", [])
    except Exception: out["pocket"] = None
    out["say"] = bool(shutil.which("say"))
    out["eleven"] = bool(os.environ.get("ELEVENLABS_API_KEY"))
    out["whisper"] = bool(shutil.which("whisper-cli") and whisper_model())
    out["ffmpeg"] = bool(shutil.which("ffmpeg"))
    return out


def synth(voice, text, wav):
    if voice.startswith("say:"):
        aiff = wav + ".aiff"
        for _ in range(3):
            try: subprocess.run(["say", "-v", voice[4:], "-o", aiff, text], check=True, timeout=90); break
            except subprocess.TimeoutExpired: continue
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", aiff, wav], check=True)
    elif voice.startswith("eleven:"):
        key = os.environ["ELEVENLABS_API_KEY"]
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice[7:]}?output_format=mp3_44100_128",
                                     json.dumps({"text": text, "model_id": "eleven_multilingual_v2"}).encode(),
                                     {"Content-Type": "application/json", "xi-api-key": key})
        mp3 = wav + ".mp3"; Path(mp3).write_bytes(urllib.request.urlopen(req, timeout=300).read())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, wav], check=True)
    else:
        Path(wav).write_bytes(get(TTS + "/speak", {"text": text, "voice": voice}))


def norm(t):
    return re.findall(r"[a-z0-9]+", t.lower())


def score(ref, wav):
    model = whisper_model()
    if not (model and shutil.which("whisper-cli")): return 1.0, "(no whisper: unchecked)"
    with tempfile.TemporaryDirectory() as td:
        w16 = Path(td) / "a.wav"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ar", "16000", "-ac", "1", str(w16)], check=True)
        hyp = subprocess.run(["whisper-cli", "-m", model, "-f", str(w16), "-nt"], capture_output=True, text=True).stdout
    # character-level on the words, so a respelt name that comes back as a near-spelling still counts
    return difflib.SequenceMatcher(None, " ".join(norm(ref)), " ".join(norm(hyp))).ratio(), hyp.strip()


def lines_for(ep, who, host):
    for nid, n in ep["nodes"].items():
        for l in n.get("lines", []):
            if host:
                o = (l.get("h") or {}).get(host)
                if o and l["who"] == who: yield {"id": f"{l['id']}@{host}", "text": o["text"], "audio": o["audio"]}
            elif l["who"] == who:
                yield l


def cmd_render(a):
    site = Path(a.site).resolve(); ep = json.loads((site / "data/episode.json").read_text())
    pron = PRON + [tuple(x) for x in json.loads((site / "data/pron.json").read_text())] if (site / "data/pron.json").exists() else PRON
    man_f = site / "audio/clips/.manifest.json"; man = json.loads(man_f.read_text()) if man_f.exists() else {}
    if not engines()["whisper"]: print("note: whisper-cli or a ggml model is missing, so takes are NOT checked (brew install whisper-cpp)")
    low, done = [], set()
    for l in lines_for(ep, a.who, a.host):
        if l["audio"] in done or (a.only and not re.search(a.only, l["id"])): continue
        done.add(l["audio"])
        t = l["text"]
        for p, r in pron: t = re.sub(p, r, t)
        key = hashlib.sha1(f"{a.voice}|{t}".encode()).hexdigest()
        out = site / l["audio"]
        if out.exists() and man.get(l["audio"]) == key and not a.force: continue
        best = None
        with tempfile.TemporaryDirectory() as td:
            for i in range(1 if a.voice.startswith("say:") else 4):
                wav = f"{td}/t{i}.wav"
                synth(a.voice, t, wav)
                r, hyp = score(l["text"], wav)
                if best is None or r > best[0]: best = (r, wav, hyp)
                if r >= 0.9: break
            out.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", best[1], "-af", AF, "-ac", "1", "-c:a", "libmp3lame", "-b:a", "72k", str(out)], check=True)
        man[l["audio"]] = key; man_f.parent.mkdir(parents=True, exist_ok=True); man_f.write_text(json.dumps(man, indent=0))
        print(f"ok {l['id']} match={best[0]:.2f}" + ("" if best[0] >= 0.85 else f"  LOW: heard '{best[2]}'"), flush=True)
        if best[0] < 0.85: low.append(l["id"])
    print(f"done: {len(done)} lines" + (f", {len(low)} LOW: {', '.join(low)}" if low else ""))


def cmd_clone(a):
    b64 = base64.b64encode(Path(a.sample).read_bytes()).decode()
    print(get(TTS + "/save", {"name": a.name, "audio_b64": b64, "start": a.start, "duration": a.duration}, timeout=180).decode())
    print(f"saved as '{a.name}'. It lives on this Mac (~/.relay/voices/{a.name}.wav); delete that file to remove it.")


ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
sub.add_parser("engines")
p = sub.add_parser("clone"); p.add_argument("sample"); p.add_argument("--name", required=True)
p.add_argument("--start", type=float, default=1.0); p.add_argument("--duration", type=float, default=18.0)
p = sub.add_parser("render"); p.add_argument("--site", default="."); p.add_argument("--who", required=True); p.add_argument("--voice", required=True)
p.add_argument("--host"); p.add_argument("--only"); p.add_argument("--force", action="store_true")
a = ap.parse_args()
if a.cmd == "engines": print(json.dumps(engines(), indent=1))
elif a.cmd == "clone": cmd_clone(a)
else: cmd_render(a)
