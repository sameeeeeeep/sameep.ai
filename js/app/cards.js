// cards.js — hover cards for the desktop icons that aren't projects: the system icons, the toys, the games
// and the Wispr folder. Projects keep theirs in data/work.json (`card`), folders in era.js. Every line here
// is what the thing really does (see apps.js, era.js, games/*.js, wisprfolder.js). No thumbnail: the icon is shown.
//   { title, what, proof (the one-line why), opens (where a click goes, for things with no link), icon }
const HERE = 'Opens here, in a window';
const IA = 'Plays in your browser on the Internet Archive';
export const MORE_CARDS = {
  offthecv: { title: 'OFF THE CV', what: 'A podcast about my work, in my voice, that you steer', proof: 'Pick a host; at every fork you choose what plays next', opens: 'Opens the show', icon: 'offthecv' },
  work: { title: 'Work', what: 'Every project in one window, with videos and links', proof: 'The portfolio without the podcast', opens: HERE, icon: 'folder' },
  hd: { title: 'Macintosh HD', what: 'About this computer, and the source code', proof: 'Built by voice with Wispr Flow, Emergent and Claude', opens: HERE, icon: 'hd' },
  wispr: { title: 'Wispr Flow', what: 'Type the way you talk, and watch it clean up', proof: 'This whole site was built by talking into the real one', opens: HERE, icon: 'wispr' },
  jukebox: { title: 'Macster', what: 'A ’99 amp player: 60 songs, 48 English and 12 Hindi pop', proof: 'A new shuffle every visit', opens: HERE, icon: 'jukebox' },
  styleguide: { title: 'Wispr Style Guide', what: 'My read of Wispr Flow’s brand: logo, colour, type, voice', proof: 'Sampled from wisprflow.ai, Nov 2026', opens: HERE, icon: 'styleguide' },
  builtwith: { title: 'Built with', what: 'The real build numbers: days, Claude sessions, prompts, words dictated', proof: 'Counted from the transcripts, Wispr Flow’s history and git', opens: HERE, icon: 'builtwith' },
  readme: { title: 'Read Me.txt', what: 'How this site was talked into existence', proof: 'Every spec line was dictated into Wispr Flow', opens: HERE, icon: 'readme' },
  resume: { title: 'Résumé.doc', what: 'My CV. The file format is no longer supported.', proof: 'Try talking instead: it opens the show', opens: HERE, icon: 'resume' },
  sayhi: { title: 'Say hi', what: 'Every way to reach me', proof: 'Email, LinkedIn, GitHub, X, Threads, Instagram', opens: HERE, icon: 'sayhi' },
  make: { title: 'Make your own', what: 'Your own sameep.ai, from one sentence to your Claude or Emergent', proof: 'It reads your GitHub and builds this same iMac for you', opens: HERE, icon: 'switchboard' },
  claude: { title: 'Claude 1.0', what: 'Claude, if it had shipped in 1999. A parody.', proof: 'Runs on 8 MB of RAM and a lot of good intentions', opens: HERE, icon: 'claude' },
  chatgpt: { title: 'ChatGPT 98', what: 'ChatGPT, if it had shipped in 1998. A parody.', proof: 'Every answer is Y2K-compliant', opens: HERE, icon: 'chatgpt' },
  emergent: { title: 'Emergent', what: 'The app builder this site was made with, alongside Claude', proof: 'I talked; it built', icon: 'proj-emergent' },
  games: { title: 'More games', what: 'Classics that still run in a browser', proof: 'Road Rash, DOOM, Minesweeper, SkiFree, Tetris and more', opens: 'Opens a folder', icon: 'proj-games' },
  trash: { title: 'Trash', what: 'Things I threw out, my CV first', proof: 'It can’t be emptied. Some things are worth keeping as lessons.', opens: HERE, icon: 'trash' },
  // mine, each in its own window
  moto: { title: 'Moto Thappad', what: 'A dusk race up NH48 on a 100cc bike', proof: 'Slap past seven rivals, autos, trucks and the odd cow', opens: 'Plays here, in a window', icon: 'proj-moto' },
  snake: { title: 'Samosa Snake', what: 'Snake on a 1997 phone screen, eating samosas', proof: 'Every fifth bite is a chai that goes cold in 5 seconds', opens: 'Plays here, in a window', icon: 'proj-snake' },
  breakout: { title: 'Rangoli Breakout', what: 'A DOS-era brick breaker in rangoli patterns', proof: 'Three patterns; a falling diya widens your paddle', opens: 'Plays here, in a window', icon: 'proj-breakout' },
  // the classics
  roadrash: { title: 'Road Rash', what: 'EA’s 1991 motorbike brawler, the Mega Drive original', proof: IA, icon: 'proj-roadrash' },
  doom: { title: 'DOOM', what: 'id Software’s 1993 shooter, the DOS original', proof: IA, icon: 'proj-doom' },
  prince: { title: 'Prince of Persia', what: 'The 1990 DOS version: one hour to save the princess', proof: IA, icon: 'proj-prince' },
  simcity: { title: 'SimCity', what: 'Maxis’s 1989 city builder, the DOS original', proof: IA, icon: 'proj-simcity' },
  darkforces: { title: 'Dark Forces', what: 'LucasArts’ 1995 Star Wars shooter', proof: IA, icon: 'proj-darkforces' },
  minesweeper: { title: 'Minesweeper', what: 'The Windows classic', proof: 'Plays in your browser', icon: 'proj-minesweeper' },
  solitaire: { title: 'Solitaire', what: 'Klondike, the one every office PC had', proof: 'Plays in your browser', icon: 'proj-solitaire' },
  skifree: { title: 'SkiFree', what: 'The 1991 skiing game with the yeti', proof: 'A remake that plays in your browser', icon: 'proj-skifree' },
  tetris: { title: 'Tetris', what: 'Tetris, on tetris.com', proof: 'Plays in your browser', icon: 'proj-tetris' },
  pacman: { title: 'Pac-Man', what: 'Google’s playable Pac-Man doodle from 2010', proof: 'Plays in your browser', icon: 'proj-pacman' },
  // the Wispr folder
  'wispr-growthos': { title: 'Wispr Growth OS', what: 'A growth plan I started for your team', proof: 'Eight sections: plan, campaigns, ideas, brand, social, creators, partners, events', opens: 'Opens in a new tab · Wispr team sign-in', iconUrl: 'growth-os/icon.svg' },
  'wispr-wrapped': { title: 'Wispr Wrapped', what: 'A Wrapped of my real Wispr Flow history', proof: 'By project or by year; make yours by talking or pasting', icon: 'proj-wrapped' },
  'wispr-wispreditor': { title: 'Voice Editor', what: 'A video editor you drive by talking', proof: 'A Wispr product prototype', icon: 'proj-wispreditor' },
  'wispr-guru': { title: 'Wispr Guru', what: 'A Wispr product prototype', proof: 'Still being built', icon: 'proj-guru' },
};
