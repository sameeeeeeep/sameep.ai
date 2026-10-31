// Renders the synthesized app SFX to mono MP3: node tools/render-sfx.mjs (from site/, needs ffmpeg)
import { writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../js/app/synth.js', import.meta.url), new URL('./.synth.tmp.mjs', import.meta.url));
const { renderChime, renderDialup } = await import('./.synth.tmp.mjs');

function wav(path, data, sr) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 2);
  writeFileSync(path, b);
}
function mp3(name, data, sr) {
  const tmp = `audio/sfx/${name}.tmp.wav`;
  wav(tmp, data, sr);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-b:a', '64k', `audio/sfx/${name}.mp3`]);
  unlinkSync(tmp);
}
const d = renderDialup(22050);
mp3('dialup', d.data, d.sampleRate);
writeFileSync('audio/sfx/dialup.marks.json', JSON.stringify(d.marks, null, 1));
mp3('dialup-chime', renderChime(44100), 44100);
unlinkSync(new URL('./.synth.tmp.mjs', import.meta.url));
console.log('ok', d.marks);
