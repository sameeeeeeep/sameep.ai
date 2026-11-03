#!/usr/bin/env python3
"""visemes.py: per-clip mouth-shape timelines for the podcast puppets.

For every site/audio/clips/*.mp3:
  1. ffmpeg -> 16 kHz mono WAV
  2. whisper-cli (small model, DTW token timestamps) -> word end times
  3. align whisper words to the known script text (episode.json, matched by
     audio path incl. v.* variants); script words get the timings
  4. each word -> mouth shapes (small grapheme->viseme mapper), spread across
     the word's span weighted toward vowels; closed in gaps > 120 ms
  5. modulated by the clip's own RMS envelope (silence -> closed, a vowel on a
     quiet frame steps down one size), runs < 50 ms merged away
Writes site/data/visemes.json: { "<audio path>": [[t, shape], ...], ... }
shape is one of closed | mid | open | wide | oo.

Re-runnable: clips already in visemes.json are skipped unless --force.
Whisper output is cached in build/visemes-cache/ (--rewhisper to redo it).
Usage: OTCV_SITE=path/to/site python3 visemes.py [--force] [--rewhisper] [--only substr] [--batch 12]
Only ffmpeg, whisper-cli, python3 stdlib + numpy.
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
# the site folder: , else the current directory (run it from the site root)
SITE = os.path.abspath(os.environ.get('OTCV_SITE', '.'))
CLIPS = os.path.join(SITE, 'audio', 'clips')
OUT = os.path.join(SITE, 'data', 'visemes.json')
CACHE = os.path.join(SITE, '..', '.otcv-cache', 'whisper')  # outside the site, so it never ships
MODELS = [
    (os.path.expanduser('~/Library/Application Support/Recordly/whisper/ggml-small.bin'), 'small'),
    (os.path.expanduser('~/.relay/models/ggml-base.en.bin'), 'base.en'),
]
FR = 0.01  # analysis frame, seconds
GAP = 0.12  # a gap this long between words gets a closed mouth
MIN_RUN = 0.05

# ------------------------------------------------------------------ script text
def script_texts():
    """audio path -> spoken text, from every {text, audio} dict in episode.json"""
    d = json.load(open(os.path.join(SITE, 'data', 'episode.json')))
    out = {}

    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get('text'), str) and isinstance(o.get('audio'), str):
                out.setdefault(o['audio'], o['text'])
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(d)
    g = os.path.join(SITE, 'data', 'greetings.json')
    if os.path.exists(g):
        walk(json.load(open(g)))
    return out


# ------------------------------------------------------------------ audio
def to_wav(mp3, wav):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp3, '-ar', '16000', '-ac', '1', wav], check=True)


def rms_db(wav):
    w = wave.open(wav)
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768.0
    hop = int(16000 * FR)
    n = len(x) // hop
    r = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1))
    db = 20 * np.log10(r + 1e-5)
    # light smoothing (30 ms) so a single quiet frame does not snap the mouth shut
    k = np.ones(3) / 3
    return np.convolve(db, k, mode='same')


# ------------------------------------------------------------------ whisper
def whisper_batch(wavs):
    model, dtw = next(((m, d) for m, d in MODELS if os.path.exists(m)), (None, None))
    if not model:
        sys.exit('no whisper model found')
    cmd = ['whisper-cli', '-m', model, '-l', 'en', '-ojf', '-np', '-dtw', dtw, '-nfa', '-t', '6']
    for w in wavs:
        cmd += ['-f', w]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    res = {}
    for w in wavs:
        j = json.load(open(w + '.json'))
        words = []  # [text, end_s]
        for seg in j.get('transcription', []):
            for t in seg.get('tokens', []):
                txt = t.get('text', '')
                if txt.startswith('[_') or t.get('t_dtw', -1) < 0:
                    continue
                end = t['t_dtw'] / 100.0
                if txt.startswith(' ') or not words:
                    words.append([txt.strip(), end])
                else:
                    words[-1][0] += txt
                    words[-1][1] = max(words[-1][1], end)
        res[w] = [wd for wd in words if re.search(r'[A-Za-z0-9]', wd[0])]
    return res


# ------------------------------------------------------------------ alignment
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())


def tokens(text):
    return [w for w in re.findall(r"[A-Za-z0-9][A-Za-z0-9'’.\-]*", text) if norm(w)]


def spans_from_whisper(ww, db):
    """whisper word ends -> (start, end); DTW marks roughly the end of a token"""
    out = []
    loud = db > speech_floor(db)
    pw = 10 ** (db / 10)
    onset = next((i * FR for i, v in enumerate(loud) if v), 0.0)
    prev = max(0.0, onset - 0.02)
    for txt, end in ww:
        end = max(end, prev + 0.06)
        # a word cannot be much longer than its letters: a long run-up (breath,
        # laugh, a pause whisper folded into the next word) becomes a gap
        maxdur = 0.14 + 0.075 * len(norm(txt))
        s, e = prev, end
        if e - s > maxdur:
            # the span holds a pause too: the word is the loudest stretch of it
            # (DTW often hangs a following pause on the end of a word)
            a, b, L = int(s / FR), min(len(db), int(e / FR)), int(maxdur / FR)
            if b - a > L:
                cs = np.concatenate([[0], np.cumsum(pw[a:b])])
                k = int(np.argmax(cs[L:] - cs[:-L]))
                s, e = (a + k) * FR, (a + k + L) * FR
        # trim silence at the head / tail of the span (pauses belong to the gap)
        i0, i1 = int(s / FR), min(len(db), int(e / FR))
        while i0 < i1 - 4 and not loud[i0]:
            i0 += 1
        while i1 > i0 + 4 and not loud[i1 - 1]:
            i1 -= 1
        out.append([txt, i0 * FR, i1 * FR])
        prev = end
    return out


def align(script, wsp):
    """script words take whisper timings; unmatched runs share their span by length"""
    if not script:
        return wsp
    a = [norm(w) for w in script]
    b = [norm(w[0]) for w in wsp]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    out = [None] * len(script)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1):
                out[i1 + k] = [script[i1 + k], wsp[j1 + k][1], wsp[j1 + k][2]]
        elif tag in ('replace', 'insert') and i2 > i1 and j2 > j1:
            s, e = wsp[j1][1], wsp[j2 - 1][2]
            lens = [max(1, len(norm(w))) for w in script[i1:i2]]
            tot, acc = sum(lens), 0
            for k, L in enumerate(lens):
                out[i1 + k] = [script[i1 + k], s + (e - s) * acc / tot, s + (e - s) * (acc + L) / tot]
                acc += L
    # script words whisper never heard: squeeze into the neighbours' gap
    for i, w in enumerate(out):
        if w is None:
            ps = next((out[k][2] for k in range(i - 1, -1, -1) if out[k]), 0.0)
            ns = next((out[k][1] for k in range(i + 1, len(out)) if out[k]), ps + 0.2)
            out[i] = [script[i], ps, max(ps + 0.05, min(ns, ps + 0.25))]
    return out


# ------------------------------------------------------------------ grapheme -> viseme
VOW = set('aeiouy')
# (pattern, shapes, weight per shape) checked in order at each position
RULES = [
    ('igh', ['wide', 'open'], 2), ('eigh', ['open'], 2), ('ough', ['oo'], 2), ('augh', ['open'], 2),
    ('tion', ['mid', 'mid'], 1), ('sion', ['mid', 'mid'], 1),
    ('ee', ['open'], 2), ('ea', ['open'], 2), ('ie', ['open'], 2), ('ei', ['open'], 2), ('ey', ['open'], 2),
    ('ai', ['open'], 2), ('ay', ['open'], 2),
    ('oo', ['oo'], 2), ('ue', ['oo'], 2), ('ew', ['oo'], 2), ('ui', ['oo'], 2),
    ('ou', ['wide', 'oo'], 2), ('ow', ['open', 'oo'], 2), ('oa', ['oo'], 2), ('oi', ['oo', 'open'], 2), ('oy', ['oo', 'open'], 2),
    ('aw', ['open'], 2), ('au', ['open'], 2),
    ('th', ['mid'], 1), ('sh', ['oo'], 1), ('ch', ['oo'], 1), ('ck', ['mid'], 1), ('ng', ['mid'], 1),
    ('ph', ['teeth'], 1), ('wh', ['oo'], 1), ('qu', ['oo'], 1),
]
CONS = {'m': 'closed', 'b': 'closed', 'p': 'closed', 'f': 'teeth', 'v': 'teeth', 'w': 'oo', 'q': 'oo', 'j': 'oo'}
WHOLE = {'i': [('wide', 2), ('open', 1)], 'a': [('mid', 1)], 'the': [('mid', 1), ('mid', 1)], 'to': [('mid', 1), ('oo', 1)],
         'you': [('open', 1), ('oo', 2)], 'oh': [('oo', 2)], 'ok': [('oo', 2), ('mid', 1), ('open', 2)],
         'okay': [('oo', 2), ('mid', 1), ('open', 2)], 'so': [('mid', 1), ('oo', 2)], 'no': [('mid', 1), ('oo', 2)],
         'go': [('mid', 1), ('oo', 2)], 'ha': [('mid', 1), ('wide', 2)], 'yeah': [('open', 2), ('wide', 1)]}
NUM = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'}


def word_shapes(word):
    w = norm(word)
    if not w:
        return [('mid', 1)]
    if w in WHOLE:
        return list(WHOLE[w])
    w = ''.join(NUM.get(c, c) for c in w)
    # silent final e (make, time, those), not "the", "be", "see"
    if len(w) > 3 and w.endswith('e') and w[-2] not in VOW and w[-3] in VOW:
        w = w[:-1]
    out, i = [], 0
    while i < len(w):
        for pat, shapes, wt in RULES:
            if w.startswith(pat, i):
                out += [(s, wt) for s in shapes]
                i += len(pat)
                break
        else:
            c = w[i]
            nxt = w[i + 1] if i + 1 < len(w) else ''
            if c == nxt and c not in VOW:  # doubled consonant
                i += 1
                continue
            if c == 'a':
                out.append(('wide', 2))
            elif c == 'o':
                out.append(('oo' if not nxt or nxt == 'w' else 'open', 2))
            elif c == 'u':
                rounded = (not nxt) or (i + 2 < len(w) and w[i + 2] == 'e' and w[i + 1] not in VOW)
                out.append(('oo' if rounded else 'mid', 2))
            elif c in 'ei':
                out.append(('open', 2))
            elif c == 'y':
                out.append(('open', 2) if i > 0 else ('mid', 1))
            elif c == 'r' and i > 0 and w[i - 1] in VOW:
                pass  # r-coloured vowel: no extra shape
            elif c == 'h' or c == 'e':
                pass
            else:
                out.append((CONS.get(c, 'mid'), 1))
            i += 1
    return out or [('mid', 1)]


VOWEL_SHAPES = ('open', 'wide', 'oo')
STEP_DOWN = {'wide': 'open', 'open': 'mid', 'oo': 'oo', 'mid': 'mid'}


def speech_floor(db):
    ref = np.percentile(db, 95)
    noise = np.percentile(db, 8)
    return max(noise + 6, ref - 30)


def build_cues(words, db):
    n = len(db)
    frames = ['closed'] * n
    for txt, s, e in words:
        sh = word_shapes(txt)
        i0, i1 = int(round(s / FR)), min(n, int(round(e / FR)))
        if i1 <= i0:
            continue
        tot = sum(w for _, w in sh)
        acc = 0
        for shape, wt in sh:
            a = i0 + int(round((i1 - i0) * acc / tot))
            acc += wt
            b = i0 + int(round((i1 - i0) * acc / tot))
            for k in range(a, max(b, a + 1)):
                if k < n:
                    frames[k] = 'mid' if shape == 'teeth' else shape
    # short gaps between words: carry the previous shape (mouth does not snap shut)
    word_frames = np.zeros(n, bool)
    for _, s, e in words:
        word_frames[int(round(s / FR)):min(n, int(round(e / FR)))] = True
    k = 0
    while k < n:
        if not word_frames[k]:
            j = k
            while j < n and not word_frames[j]:
                j += 1
            if (j - k) * FR < GAP and k > 0 and j < n:
                for q in range(k, j):
                    frames[q] = 'mid' if frames[k - 1] != 'closed' else 'closed'
            k = j
        else:
            k += 1
    # loudness modulation
    floor = speech_floor(db)
    ref = np.percentile(db, 95)
    for k in range(n):
        if db[k] < floor:
            frames[k] = 'closed'
        elif frames[k] in VOWEL_SHAPES and db[k] < ref - 15:
            frames[k] = STEP_DOWN[frames[k]]
    # run-length encode, then merge runs shorter than 50 ms into a neighbour
    runs = []
    for k, f in enumerate(frames):
        if runs and runs[-1][1] == f:
            runs[-1][2] += 1
        else:
            runs.append([k, f, 1])
    minf = int(round(MIN_RUN / FR))
    changed = True
    while changed and len(runs) > 1:
        changed = False
        for i, r in enumerate(runs):
            if r[2] >= minf:
                continue
            # a short m/b/p closure is still worth showing: stretch it a little
            if r[1] == 'closed' and r[2] >= 3 and 0 < i < len(runs) - 1:
                continue
            if i == 0:
                tgt = 1
            elif i == len(runs) - 1:
                tgt = i - 1
            else:
                tgt = i - 1 if runs[i - 1][2] >= runs[i + 1][2] else i + 1
            if tgt < i:
                runs[tgt][2] += r[2]
            else:
                runs[tgt][0] = r[0]
                runs[tgt][2] += r[2]
            runs.pop(i)
            # fuse equal neighbours
            j = 0
            while j < len(runs) - 1:
                if runs[j][1] == runs[j + 1][1]:
                    runs[j][2] += runs[j + 1][2]
                    runs.pop(j + 1)
                else:
                    j += 1
            changed = True
            break
    cues = [[round(r[0] * FR, 2), r[1]] for r in runs]
    if cues and cues[0][0] != 0:
        cues.insert(0, [0, 'closed'])
    if cues:
        cues[0][0] = 0
    return cues


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--rewhisper', action='store_true')
    ap.add_argument('--only', default='')
    ap.add_argument('--batch', type=int, default=12)
    a = ap.parse_args()
    os.makedirs(CACHE, exist_ok=True)
    texts = script_texts()
    data = json.load(open(OUT)) if os.path.exists(OUT) else {}
    clips = sorted(f for f in os.listdir(CLIPS) if f.endswith('.mp3') and a.only in f)
    todo = [f for f in clips if a.force or f'audio/clips/{f}' not in data]
    print(f'{len(todo)} of {len(clips)} clips to do', flush=True)
    tmp = tempfile.mkdtemp(prefix='visemes-')
    for b in range(0, len(todo), a.batch):
        chunk = todo[b:b + a.batch]
        wavs = {}
        for f in chunk:
            wav = os.path.join(tmp, f[:-4] + '.wav')
            to_wav(os.path.join(CLIPS, f), wav)
            wavs[f] = wav
        need = [f for f in chunk if a.rewhisper or not os.path.exists(os.path.join(CACHE, f[:-4] + '.json'))]
        if need:
            res = whisper_batch([wavs[f] for f in need])
            for f in need:
                json.dump(res[wavs[f]], open(os.path.join(CACHE, f[:-4] + '.json'), 'w'))
        for f in chunk:
            key = f'audio/clips/{f}'
            ww = json.load(open(os.path.join(CACHE, f[:-4] + '.json')))
            db = rms_db(wavs[f])
            words = align(tokens(texts.get(key, '')), spans_from_whisper(ww, db))
            data[key] = build_cues(words, db)
            os.remove(wavs[f])
            for ext in ('.json',):
                p = wavs[f] + ext
                if os.path.exists(p):
                    os.remove(p)
        # write after every batch so a background run can be stopped any time
        data = dict(sorted(data.items()))
        with open(OUT + '.tmp', 'w') as fh:
            json.dump(data, fh, separators=(',', ':'))
        os.replace(OUT + '.tmp', OUT)
        print(f'{min(b + a.batch, len(todo))}/{len(todo)} done, {os.path.getsize(OUT) // 1024} KB', flush=True)


if __name__ == '__main__':
    main()
