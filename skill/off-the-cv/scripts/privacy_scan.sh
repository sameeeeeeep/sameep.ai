#!/bin/sh
# privacy_scan.sh <site-dir>: what must never ship. Prints hits and exits 1, or prints "clean".
# Emails, phone numbers, API keys / tokens, private keys, .env files, home paths, voice samples.
D="${1:-.}"; hits=0
scan() { out=$(grep -RInE --exclude-dir=vendor --exclude-dir=.git --exclude=*.min.js "$1" "$D" 2>/dev/null | grep -vE "$2" | head -20); [ -n "$out" ] && { echo "== $3"; echo "$out"; hits=1; }; }
scan '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' 'noreply@|@sameeeeeeep|@media|@import|@keyframes|@font-face|@supports|@container|@layer|@property|\.(svg|webp|png|mp3)' "email addresses"
scan '(\+|\b00)[1-9][0-9 ()-]{9,}[0-9]' '"(t|ts|frames|head|box|size|patch)"|\[\[|[0-9]\.[0-9]' "phone numbers"
scan 'sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|xi-api-key: *[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY' 'process\.env|\$ELEVENLABS|environ' "keys and tokens"
scan '/Users/[a-z]+/|/home/[a-z]+/' 'x^' "local paths"
f=$(find "$D" \( -name ".env*" -o -name "*.pem" -o -name "sample.wav" -o -name "*.voice.wav" -o -name "id_rsa*" \) -not -path "*/.git/*" 2>/dev/null)
[ -n "$f" ] && { echo "== files that shouldn't ship"; echo "$f"; hits=1; }
[ "$hits" = 0 ] && echo clean
exit $hits
