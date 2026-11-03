# The starter template

A "make your own sameep.ai" site is two things:

1. **The engine**: the open-source site at https://github.com/sameeeeeeep/sameep.ai (MIT). The CV shred
   and burn, the CD, the Bondi iMac, the dial-up, the Mac OS 8 desktop, the podcast player with lip-sync,
   karaoke subtitles, voice steering, the three hosts (Foyra Gold, Gus Halloran, K-56) and the studio.
2. **One config file**, `me.json` (see `me.example.json`), plus the person's episode script, their guest
   sprite and their voice clips.

`scripts/scaffold.py` joins them: it copies the engine, strips everything that is Sameep's (his case
studies, clips, video, sprite, the Wispr team, his analytics Worker and domain), and writes:

| file in the new site        | from |
|-----------------------------|------|
| `persona.json`              | me.json: name, tagline, links, host name |
| `data/episode.json`         | the episode you write (or `starter_episode.py`'s skeleton) |
| `data/work.json` + desktop folders | me.json `projects` |
| `js/hero/cv.js`             | me.json `cv`: the CV that gets shredded |
| `img/sprites/guest/*.webp`  | `sprite.py` (from their photo, or a pixel stand-in) |
| `audio/clips/*.mp3`         | `voice.py render` |
| `data/visemes.json`, `words.json`, `durations.json` | `visemes.py`, `words.py`, `durations.py` |

The episode schema is documented in `../SKILL.md` and shown whole in `episode.example.json`
(run `starter_episode.py --me me.example.json --out episode.example.json` to regenerate it).
