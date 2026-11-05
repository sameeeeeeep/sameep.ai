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
    src: 'Real data: Sameep’s Wispr Flow history, 31 Oct – 5 Nov 2026, matched to the Claude Code sessions that built this site.',
    cards: [
      { id: 'intro', bg: 'lumen', k: 'Project Wrapped · 29 Oct – 5 Nov', big: 'sameep.ai', serif: true, unit: 'a portfolio, built by talking', p: '8 days, 188 commits and 83 things said out loud. Here’s what the talking looked like.', viz: { type: 'wave' } },
      { id: 'words', bg: 'dawn', k: 'Words said to this project', big: 7365, unit: 'words, spoken', p: '73% of everything I told Claude, I said out loud. The other 27% I typed, badly. More on that later.', viz: { type: 'split', items: [['Said', 7365], ['Typed', 2702]] } },
      { id: 'saved', bg: 'fathom', k: 'Time saved vs typing', big: '2h 07m', unit: 'back, roughly', p: '57 minutes of talking. Typing the same 7,365 words at 40 words a minute would take about 3 hours.', note: 'Estimate: 40 wpm is an average typist. I talked at a median 132 wpm, 207 at my fastest.' },
      { id: 'longest', bg: 'signal', k: 'Longest single take', big: 735, unit: 'words in 5 min 16 s', p: 'Saturday, 4:47am. One breath about sound effects, music and how the Diwali app demo should feel.', viz: { type: 'quote', text: '“Are you getting it all?”', by: 'how it started' } },
      { id: 'filler', bg: 'glow', k: 'Most-said phrase', big: '“you know”', serif: true, unit: '105 times', p: 'Flow kept 2 of them. It also cut all 23 ums and uhs, so Claude got 531 fewer words of me thinking.', viz: { type: 'list', items: [['I think', 82], ['so', 80], ['like', 65], ['also', 43], ['just', 38], ['sort of', 29]] } },
      { id: 'typos', bg: 'lumen', k: 'Typed vs said', big: 75, unit: 'typos in 2,702 typed words', p: 'About one every 36 words, in 45 of 137 typed prompts. My dictated prompts: none. I misspelt my own products.', viz: { type: 'chips', items: ['porfolio', 'swithcboard', 'switchbaord', 'podcasst', 'vocie', 'prototupe', 'xpereince', 'thinlk', 'pelase', 'somethign', 'fixxxx', 'broooo'] } },
      { id: 'mood', bg: 'mint', k: 'Frustration, measured', big: 'Calm-ish', serif: true, unit: 'mostly', p: '74 questions, 12 no’s, 8 still’s and 3 bro’s, against 6 yays and loves. One “broooo”. One “fixxxx”.', viz: { type: 'quote', text: '“this is not working as expected tbh”', by: 'the low point, typed' } },
      { id: 'night', bg: 'vast', k: 'Peak hour', big: '4am', serif: true, unit: '3,605 words between 4 and 5', p: '79% of my words to this project came before 6am. The site was mostly pitched in the dark, then built in the day.', viz: { type: 'hours', items: [733, 199, 875, 317, 3605, 108, 0, 0, 0, 0, 0, 0, 49, 575, 92, 0, 0, 0, 101, 0, 530, 170, 0, 11] } },
      { id: 'type', bg: 'flare', k: 'Voice personality', big: 'The 4am Director', serif: true, unit: '', p: 'Pitches the whole scene out loud, then types three words to approve it.', viz: { type: 'stats', items: [['Claude sessions', '176'], ['Commands Claude ran', '4,788'], ['Commits', '188'], ['Shortest typed prompt', '“live?”']] } },
    ],
    share: { k: 'My project, wrapped', big: '7,365', unit: 'words said to sameep.ai', tiles: [['Time back', '~2h 07m', 'fathom'], ['Peak hour', '4am', 'vast'], ['Said it', '“you know” ×105', 'glow'], ['I am', 'The 4am Director', 'signal']] },
  },
  year: {
    tab: 'Year',
    title: '2026 Wrapped',
    who: 'Sameep · every app',
    src: 'Real data: every dictation in Sameep’s Wispr Flow history. Flow went on this Mac on 31 Oct, so the year is six days long.',
    cards: [
      { id: 'intro', bg: 'lumen', k: '2026 Wrapped · so far', big: '6 days', serif: true, unit: 'of Flow, wrapped early', p: 'I installed Flow on 31 October. Six days later, this is my year in voice.', viz: { type: 'wave' } },
      { id: 'words', bg: 'dawn', k: 'Words dictated', big: 10672, unit: 'words in 147 dictations', p: 'About 43 pages, said in 85 minutes of actual talking.' },
      { id: 'saved', bg: 'fathom', k: 'Time saved vs typing', big: '3h 02m', unit: 'back, roughly', p: '10,672 words at 40 words a minute is 4 h 27 m of typing. I talked them in 1 h 25 m.', note: 'Estimate: 40 wpm is an average typist. My median was 130 wpm.' },
      { id: 'apps', bg: 'signal', k: 'Where I said it', big: 'Claude', serif: true, unit: '97% of my words', p: 'Flow works in any text box. I used it for one thing: telling Claude what to build.', viz: { type: 'list', items: [['Claude', 10382], ['Chrome', 279], ['Flow itself', 8], ['A notification reply', 2]] } },
      { id: 'longest', bg: 'glow', k: 'Longest single take', big: 894, unit: 'words in 7 min 45 s', p: 'Monday, 2:21am: the opening of my video for this application, drafted out loud in one go.', viz: { type: 'quote', text: '“Hi team Wispr, I am Sameep.”', by: 'line one' } },
      { id: 'filler', bg: 'lumen', k: 'Most-said phrase', big: '“you know”', serif: true, unit: '156 times', p: 'Flow kept 2. Next up: “like” 113, “I think” 110, “so” 110. And 51 ums and uhs, all gone.', viz: { type: 'list', items: [['like', 113], ['I think', 110], ['so', 110], ['also', 64], ['just', 53], ['sort of', 49]] } },
      { id: 'night', bg: 'vast', k: 'After dark', big: '84%', serif: true, unit: 'of my words before 6am', p: '9,000 of 10,672. Peak hour, again: 4am.', viz: { type: 'hours', items: [759, 199, 2440, 470, 4872, 260, 2, 0, 0, 0, 0, 0, 51, 684, 92, 3, 0, 0, 101, 0, 535, 170, 0, 34] } },
      { id: 'pace', bg: 'mint', k: 'At this pace', big: '~650k', serif: true, unit: 'words a year', p: 'Six days times 61. That’s about seven novels, mostly about one portfolio.', note: 'Estimate: straight-line from 6 days. It won’t hold. Probably.' },
      { id: 'type', bg: 'flare', k: 'Voice personality', big: 'The Long-Take Talker', serif: true, unit: '', p: 'Half my dictations are quick, 28 words or less. The rest are voice memos with a whole plan in them.', viz: { type: 'stats', items: [['Median take', '28 words'], ['Longest', '894 words'], ['Talking speed', '130 wpm'], ['Projects talked into', '6']] } },
    ],
    share: { k: 'My 2026 in voice, so far', big: '10,672', unit: 'words, spoken', tiles: [['Time back', '~3h 02m', 'fathom'], ['Top app', 'Claude, 97%', 'signal'], ['Said it', '“you know” ×156', 'glow'], ['I am', 'The Long-Take Talker', 'vast']] },
  },
};
