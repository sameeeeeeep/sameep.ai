#!/usr/bin/env python3
"""words.py: per-clip word timings for the karaoke subtitle highlight.

Same pipeline as visemes.py (whisper DTW word ends, cleaned up against the
clip's RMS envelope, aligned to the script text), but writes the word spans
instead of mouth shapes:
  site/data/words.json: { "<audio path>": [[t0, t1], ...], ... }
one [start, end] (seconds, 0.01 s) per script word, in order. Script words are
tokenised by TOKEN below; js/app/subtitle.js splits the shown text the same way
and only highlights when the counts agree.

Re-runnable: clips already in words.json are skipped unless --force.
Reuses build/visemes-cache/ (runs whisper only for clips missing from it).
Usage: OTCV_SITE=path/to/site python3 words.py [--force] [--only substr] [--batch 12]
"""
import argparse
import json
import os
import re
import tempfile

import visemes as V

OUT = os.path.join(V.SITE, 'data', 'words.json')
# keep in step with WORD in js/app/subtitle.js
TOKEN = re.compile(r"[^\W_][\w'’.\-]*")


def tokens(text):
    return [w for w in TOKEN.findall(text) if V.norm(w)]


def monotonic(spans):
    """starts never go backwards (the player binary-searches them). Out-of-order spans come
    from words whisper never heard, squeezed in by align(): walking back from the end,
    a word may not start after the next one, so the guessed words give way, not the heard ones."""
    for i in range(len(spans) - 2, -1, -1):
        nxt = spans[i + 1][0]
        if spans[i][0] > nxt:
            spans[i][0] = nxt
        spans[i][1] = min(spans[i][1], max(nxt, spans[i][0] + 0.05))
    return [[round(s, 2), round(max(e, s + 0.05), 2)] for s, e in spans]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--only', default='')
    ap.add_argument('--batch', type=int, default=12)
    a = ap.parse_args()
    os.makedirs(V.CACHE, exist_ok=True)
    texts = V.script_texts()
    data = json.load(open(OUT)) if os.path.exists(OUT) else {}
    clips = sorted(f for f in os.listdir(V.CLIPS) if f.endswith('.mp3') and a.only in f)
    todo = [f for f in clips if a.force or f'audio/clips/{f}' not in data]
    print(f'{len(todo)} of {len(clips)} clips to do', flush=True)
    tmp = tempfile.mkdtemp(prefix='words-')
    for b in range(0, len(todo), a.batch):
        chunk = todo[b:b + a.batch]
        wavs = {}
        for f in chunk:
            wav = os.path.join(tmp, f[:-4] + '.wav')
            V.to_wav(os.path.join(V.CLIPS, f), wav)
            wavs[f] = wav
        need = [f for f in chunk if not os.path.exists(os.path.join(V.CACHE, f[:-4] + '.json'))]
        if need:
            res = V.whisper_batch([wavs[f] for f in need])
            for f in need:
                json.dump(res[wavs[f]], open(os.path.join(V.CACHE, f[:-4] + '.json'), 'w'))
        for f in chunk:
            key = f'audio/clips/{f}'
            script = tokens(texts.get(key, ''))
            if script:
                ww = json.load(open(os.path.join(V.CACHE, f[:-4] + '.json')))
                words = V.align(script, V.spans_from_whisper(ww, V.rms_db(wavs[f])))
                data[key] = monotonic([[s, e] for _, s, e in words])
            for p in (wavs[f], wavs[f] + '.json'):
                if os.path.exists(p):
                    os.remove(p)
        data = dict(sorted(data.items()))
        with open(OUT + '.tmp', 'w') as fh:
            json.dump(data, fh, separators=(',', ':'))
        os.replace(OUT + '.tmp', OUT)
        print(f'{min(b + a.batch, len(todo))}/{len(todo)} done, {os.path.getsize(OUT) // 1024} KB', flush=True)


if __name__ == '__main__':
    main()
