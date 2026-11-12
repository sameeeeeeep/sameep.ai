// _lib.mjs: a tiny DOM-free test helper for page modules (owned by Design; frozen). Run: node test/<x>.test.mjs
let failures = 0;
export function check(name, ok, detail) {
  if (ok) console.log(`  ok    ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail === undefined ? '' : '  ' + String(detail).slice(0, 300)}`); }
}
export function done() { console.log(failures ? `\n${failures} failed` : '\nall passed'); process.exit(failures ? 1 : 0); }
// Brand rule: some names must never appear. They are kept here only as SHA-256 hashes of the lowercased word,
// so this public file does not spell them out. hasBanned(text) checks every word in the text.
import { createHash } from 'node:crypto';
const BANNED_HASHES = new Set([
  '604c9738ca7b849d40b4c2f80d2b863662000b9b0c1148c43b4c351e6ee5b2e5',
  '5281e90e3bcc8cf78c5f9cd0714b07a2cf1117542f58c8f89a327dd0ab44f4be',
  'b660ea361904c6e0b9c9f120141e8ab671e3dc650ade8b20d5e8e3fc0d3edca5',
]);
export const hasBanned = (text) => (String(text).match(/[a-z]+/gi) || []).some((w) => BANNED_HASHES.has(createHash('sha256').update(w.toLowerCase()).digest('hex')));
export const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
export const ctxFor = (role = 'admin', demo = true) => ({ wid: 'unfiltrd', ws: { id: 'unfiltrd', name: 'Unfiltrd', demo, role }, role, params: [] });
