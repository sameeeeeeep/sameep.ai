#!/bin/sh
# Installs the off-the-cv skill for Claude Code into ~/.claude/skills/off-the-cv/.
# Then tell your Claude: "make your own sameep.ai using my GitHub profile".
# Read it first if you like: https://sameep.ai/skill/off-the-cv/install.sh
set -e
BASE="${OTCV_BASE:-https://sameep.ai/skill/off-the-cv}"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/off-the-cv"
mkdir -p "$DEST/scripts" "$DEST/template"
for f in SKILL.md \
  scripts/scaffold.py scripts/starter_episode.py scripts/check_episode.py scripts/github_projects.py \
  scripts/sprite.py scripts/face.swift scripts/voice.py scripts/visemes.py scripts/words.py scripts/durations.py \
  scripts/privacy_scan.sh template/me.example.json template/episode.example.json template/README.md; do
  curl -fsSL "$BASE/$f" -o "$DEST/$f"
done
chmod +x "$DEST"/scripts/*.py "$DEST"/scripts/*.sh
echo "Installed to $DEST"
echo "Needs: python3 with Pillow (pip3 install pillow), ffmpeg + whisper-cpp for the voice step (brew install ffmpeg whisper-cpp)."
echo "Now tell Claude: make your own sameep.ai using my GitHub profile"
