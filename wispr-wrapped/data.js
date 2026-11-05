// data.js — Sameep's real numbers. Read on his Mac from Wispr Flow's local history (flow.sqlite) and matched
// to his Claude Code sessions for this site, 5 Nov 2026. Only totals and a few of his own lines leave the Mac:
// no transcripts, no audio. Each card is plain data so the page and the 1080×1920 PNG draw the same thing.
// A plain script (sets window.WW_DATA) so the same renderer runs on the site and from disk.
// Colours: Wispr Flow's palette (lumen, dawn, signal, glow, fathom, vast, mint, flare), as sampled for Growth OS.

window.WW_DATA = {};
const C = window.WW_DATA.C = {
  lumen: '#ffffeb', paper: '#fffdf9', vast: '#1a1a1a', mute: '#5d5d52', fathom: '#034f46', dawn: '#f0d7ff',
  signal: '#ffbcf2', glow: '#ffa946', flare: '#ff6c4c', pulse: '#7f1c34', mint: '#cfe8dc',
};

window.WW_DATA.STORIES = {
  project: {
    tab: 'Project',
    title: 'Project Wrapped',
    who: 'Sameep · sameep.ai',
    src: 'Real data from Sameep’s Wispr Flow history and the Claude Code sessions that built this site. Snapshot from early 5 Nov 2026.',
    cards: [
      { id: 'intro', bg: 'lumen', k: 'Project Wrapped · 29\u00a0Oct\u00a0–\u00a05\u00a0Nov', big: 'sameep.ai', serif: true, unit: 'a portfolio, built by talking', p: '8 days, 208 commits and 66 dictations into Claude. Here’s what the talking looked like.', viz: { type: 'wave' } },
      { id: 'words', bg: 'dawn', k: 'Words said to it · since Flow, 31\u00a0Oct', big: 6539, unit: 'words, spoken', p: '57% of everything I told Claude here, I said out loud. The other 43% I typed, badly. More on that later.', viz: { type: 'split', items: [['Said', 6539], ['Typed', 4965]] } },
      { id: 'saved', bg: 'fathom', k: 'Time saved vs typing', big: '1h 52m', unit: 'back, roughly', p: '52 minutes of talking. Typing the same 6,539 words at 40 words a minute would take about 2h 43m.', note: 'Estimate: 40 wpm is an average typist. I talked at a median 130 wpm, 207 at my fastest.' },
      { id: 'longest', bg: 'signal', k: 'Longest single take', big: 735, unit: 'words in 5 min 15 s', p: 'Saturday, 4:47am. One breath about sound effects, music and how the Diwali app demo should feel.', viz: { type: 'quote', text: '“Are you getting it all?”', by: 'how it started' } },
      { id: 'filler', bg: 'glow', k: 'Most-said phrase', big: '“you know”', serif: true, unit: '98 times', p: 'Flow kept 2 of them. It also cut all 21 ums and uhs, so Claude got 492 fewer words of me thinking.', viz: { type: 'list', items: [['I think', 70], ['so', 69], ['like', 59], ['also', 38], ['just', 35], ['sort of', 26]] } },
      { id: 'typos', bg: 'lumen', k: 'Typed vs said', big: 204, unit: 'typos in 4,965 typed words', p: 'About one every 24 words, in 78 of 183 typed prompts. The prompts I said, Flow spelt for me. I misspelt my own products.', viz: { type: 'chips', items: ['porfolio', 'switchbaord', 'conenct', 'spirte', 'somethign', 'waht', 'pelase', 'bansky', 'efffect', 'broooo'] } },
      { id: 'mood', bg: 'mint', k: 'Frustration, measured', big: 'Calm-ish', serif: true, unit: 'mostly', p: '134 questions, 21 no’s, 10 still’s and 6 bro’s, against 14 yays and loves. One “broooo”.', viz: { type: 'quote', text: '“wrong thread, sorry”', by: 'the low point, typed' } },
      { id: 'night', bg: 'vast', k: 'Peak hour', big: '4am', serif: true, unit: '3,605 words between 4 and 5', p: '81% of my words to this project came before 6am. The site was mostly pitched in the dark, then built in the day.', viz: { type: 'hours', items: [733, 147, 477, 225, 3605, 108, 0, 0, 0, 0, 0, 0, 0, 510, 92, 0, 0, 0, 101, 0, 530, 0, 0, 11] } },
      { id: 'type', bg: 'flare', k: 'Voice personality', big: 'The 4am Director', serif: true, unit: '', p: 'Pitches the whole scene out loud, then types three words to approve it.', viz: { type: 'stats', items: [['Claude sessions', '18'], ['Commands Claude ran', '5,419'], ['Commits', '208'], ['Shortest typed prompt', '“sup”']] } },
    ],
    share: { k: 'My project, wrapped', big: '6,539', unit: 'words said to sameep.ai', tiles: [['Time back', '~1h 52m', 'fathom'], ['Peak hour', '4am', 'vast'], ['Said it', '“you know” ×98', 'glow'], ['I am', 'The 4am Director', 'signal']] },
  },
  year: {
    tab: 'Year',
    title: '2026 Wrapped',
    who: 'Sameep · every app',
    src: 'Real data: every dictation in Sameep’s Flow history. Flow went on this Mac on 31 Oct, so the year is six days long.',
    cards: [
      { id: 'intro', bg: 'lumen', k: '2026 Wrapped · so far', big: '6 days', serif: true, unit: 'of Flow, wrapped early', p: 'I installed Flow on 31 October. 155 dictations later, this is my year in voice.', viz: { type: 'wave' } },
      { id: 'words', bg: 'dawn', k: 'Words dictated · 31\u00a0Oct\u00a0–\u00a05\u00a0Nov', big: 11344, unit: 'words in 155 dictations', p: 'About 45 pages, said in 1h 29m of actual talking.' },
      { id: 'saved', bg: 'fathom', k: 'Time saved vs typing', big: '3h 14m', unit: 'back, roughly', p: '11,344 words at 40 words a minute is 4h 44m of typing. I talked them in 1h 29m.', note: 'Estimate: 40 wpm is an average typist. My median was 130 wpm.' },
      { id: 'apps', bg: 'signal', k: 'Where I said it', big: 'Claude', serif: true, unit: '97% of my words', p: 'Flow works in any text box. I used it for one thing: telling Claude what to build.', viz: { type: 'list', items: [['Claude', 11020], ['Chrome', 294]] } },
      { id: 'longest', bg: 'glow', k: 'Longest single take', big: 894, unit: 'words in 7 min 45 s', p: 'Monday, 2:21am: the opening of my video for this application, drafted out loud in one go.', viz: { type: 'quote', text: '“Hi team Wispr, I am Sameep.”', by: 'line one' } },
      { id: 'filler', bg: 'lumen', k: 'Most-said phrase', big: '“you know”', serif: true, unit: '163 times', p: 'Flow kept 2. Next up: “like” 121, “so” 119, “I think” 117. And 52 ums and uhs, all gone.', viz: { type: 'list', items: [['like', 121], ['so', 119], ['I think', 117], ['also', 66], ['just', 55], ['sort of', 50]] } },
      { id: 'night', bg: 'vast', k: 'After dark', big: '85%', serif: true, unit: 'of my words before 6am', p: 'Peak hour, again: 4am. 4,904 words between 4 and 5.', viz: { type: 'hours', items: [759, 275, 3004, 470, 4904, 260, 2, 0, 0, 0, 0, 0, 51, 684, 92, 3, 0, 0, 101, 0, 535, 170, 0, 34] } },
      { id: 'pace', bg: 'mint', k: 'At this pace', big: '~690k', serif: true, unit: 'words a year', p: 'That’s about eight novels, mostly about one portfolio.', note: 'Estimate: straight-line from 6 days. It won’t hold. Probably.' },
      { id: 'type', bg: 'flare', k: 'Voice personality', big: 'The Night-Shift Talker', serif: true, unit: '', p: 'Does the best thinking after midnight, out loud.', viz: { type: 'stats', items: [['Median take', '28 words'], ['Longest', '894 words'], ['Talking speed', '130 wpm'], ['Apps', '5']] } },
    ],
    share: { k: 'My 2026 in voice · 31\u00a0Oct\u00a0–\u00a05\u00a0Nov', big: '11,344', unit: 'words, spoken', tiles: [['Time back', '~3h 14m', 'fathom'], ['Top app', 'Claude, 97%', 'signal'], ['Said it', '“you know” ×163', 'glow'], ['I am', 'The Night-Shift Talker', 'vast']] },
  },
};
