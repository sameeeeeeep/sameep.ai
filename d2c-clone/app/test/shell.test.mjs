// shell.test.mjs: router, api base resolution, escaping, sign-in views. node test/shell.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { check, done, hasBanned, EMOJI } from './_lib.mjs';
import { parseHash, hrefFor, NAV } from '../js/app.js';
import { resolveBase } from '../js/api.js';
import { html, raw, inr, usd, day } from '../js/ui.js';
import { view as signin } from '../pages/signin.js';

console.log('shell');
check('parse os route', JSON.stringify(parseHash('#/w/unfiltrd/os/pos')) === JSON.stringify({ wid: 'unfiltrd', section: 'os', params: ['pos'] }));
check('unknown section -> null', parseHash('#/w/unfiltrd/nope').section === null);
check('no route', parseHash('').wid === null);
check('href round trip', parseHash(hrefFor('unfiltrd', 'chats', 'all-hands')).params[0] === 'all-hands');
check('six nav sections', NAV.map((n) => n.section).join() === 'today,chats,hub,os,team,billing');
check('live page uses same origin', resolveBase({ hostname: 'sameep.ai', search: '?api=http://localhost:8787' }) === '/d2c-api');
check('local page may point at local worker', resolveBase({ hostname: 'localhost', search: '?api=http://localhost:8787' }) === 'http://localhost:8787/d2c-api');
check('local page refuses a remote api', resolveBase({ hostname: 'localhost', search: '?api=https://evil.example' }) === '/d2c-api');
check('remembered local api', resolveBase({ hostname: '127.0.0.1', search: '' }, 'http://127.0.0.1:8787') === 'http://127.0.0.1:8787/d2c-api');
check('html escapes', String(html`<p>${'<b>"x"</b>'}</p>`) === '<p>&lt;b&gt;&quot;x&quot;&lt;/b&gt;</p>');
check('raw passes through', String(html`<p>${raw('<b>x</b>')}</p>`) === '<p><b>x</b></p>');
check('money and dates', inr(123456700) === '₹12,34,567' && usd(1000) === '$1,000' && day('2026-11-02') === '2 Nov 2026');
const si = String(signin({ email: 'a"b@x.co' })), sc = String(signin({ step: 'code', email: 'a@x.co', error: 'bad' }));
check('signin email step', si.includes('id="si-email"') && si.includes('a&quot;b@x.co'));
check('signin code step', sc.includes('one-time-code') && sc.includes('bad'));

// brand and emoji rules over every file in the app folder
const root = new URL('..', import.meta.url).pathname;
const files = [];
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { if (f.isDirectory()) walk(d + f.name + '/'); else if (/\.(js|mjs|css|html)$/.test(f.name) && true) files.push(d + f.name); } };
walk(root);
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  check(`no banned names or emojis: ${f.slice(root.length)}`, !hasBanned(s) && !EMOJI.test(s));
}
done();
