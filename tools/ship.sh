#!/usr/bin/env bash
# Släpper en ny version av SortBro: höjer patchversionen, bygger XPI:n,
# uppdaterar updates.json, kör alla tester och publicerar.
#
#   tools/ship.sh            # höj versionen och publicera
#   tools/ship.sh --check    # bygg och testa, men publicera inte
#
# Varför versionssteg: Thunderbird jämför versionsnummer, inte filinnehåll.
# Utan ett högre nummer uppdateras ingenting, hur många filer som än byts.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

BRANCH=arena/4044d6f0-lasfilter
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

say(){ printf '\n\033[1m%s\033[0m\n' "$*"; }
die(){ printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

say "1/7 · kontrollerar läget"
[ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || die "fel gren: $(git rev-parse --abbrev-ref HEAD)"
git fetch -q origin
git merge-base --is-ancestor origin/$BRANCH HEAD || die "lokala grenen ligger efter origin – kör git reset --hard origin/$BRANCH"
if [ -n "$(git status --porcelain)" ] && [ -z "${SHIP_DIRTY_OK:-}" ]; then
 die "arbetsträdet är inte rent – committa eller städa först"
fi

say "2/7 · höjer versionen"
OLD=$(python3 -c "import json;print(json.load(open('addon/manifest.json'))['version'])")
NEW=$(python3 - "$OLD" <<'PY'
import sys
a,b,c = (int(x) for x in sys.argv[1].split('.'))
print(f"{a}.{b}.{c+1}")
PY
)
python3 - "$OLD" "$NEW" <<'PY'
import json, re, sys
old, new = sys.argv[1], sys.argv[2]

p = 'addon/manifest.json'
s = open(p, encoding='utf-8').read()
s = s.replace(f'"version": "{old}"', f'"version": "{new}"', 1)
open(p, 'w', encoding='utf-8').write(s)

# Reservtexten i gränssnittet hålls i takt; i det riktiga tillägget läses
# versionen ur manifestet, men texten används i förhandsvisningen.
p = 'addon/ui.js'
s = open(p, encoding='utf-8').read()
s = s.replace(f'v{old}', f'v{new}')
open(p, 'w', encoding='utf-8').write(s)

# Samma reservtext finns i ui.html: sidfoten skrivs om av koden, men faller
# tillbaka på den här raden om skriptet inte hunnit köra.
p = 'addon/ui.html'
s = open(p, encoding='utf-8').read()
s = s.replace(f'v{old}', f'v{new}')
open(p, 'w', encoding='utf-8').write(s)

p = 'updates.json'
d = json.load(open(p, encoding='utf-8'))
d['addons']['lasfilter@lokala-verktyg.invalid']['updates'][0]['version'] = new
open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print(f'{old} -> {new}')
PY

say "3/7 · bygger XPI:n"
rm -f /tmp/sortbro-build.xpi
(cd addon && zip -r -X -q /tmp/sortbro-build.xpi . -x '.*' -x '*/.*')
cp /tmp/sortbro-build.xpi SortBro-Thunderbird.xpi
cp /tmp/sortbro-build.xpi Lasfilter-Thunderbird.xpi
HASH=$(sha256sum SortBro-Thunderbird.xpi | cut -d' ' -f1)
echo "$HASH  SortBro-Thunderbird.xpi" > SortBro-Thunderbird.xpi.sha256
python3 - "$HASH" <<'PY'
import json, sys
h = sys.argv[1]
p = 'updates.json'
d = json.load(open(p, encoding='utf-8'))
d['addons']['lasfilter@lokala-verktyg.invalid']['updates'][0]['update_hash'] = 'sha256:' + h
open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('sha256', h)
PY

say "4/7 · kontrollerar paketet"
rm -rf /tmp/sortbro-check && mkdir /tmp/sortbro-check
unzip -q SortBro-Thunderbird.xpi -d /tmp/sortbro-check
diff -r addon /tmp/sortbro-check >/dev/null || die "XPI:n stämmer inte med addon/"
echo "zip == addon"

say "5/7 · kör testerna"
[ -d tester/node_modules ] || (cd tester && npm install --silent)
node --test tester/*.test.cjs
(cd tester && node dom_check.cjs | tail -1)

say "6/7 · kontrollerar att version, hash och adresser hör ihop"
python3 tools/verify_release.py

if [ "$CHECK_ONLY" = "1" ]; then
 say "klart (endast kontroll) – version $NEW är byggd men inte publicerad"
 exit 0
fi

say "7/7 · publicerar $NEW"
git add -A
git commit -q -m "SortBro $NEW"
git push -q origin "$BRANCH"
git tag -f "v$NEW" >/dev/null
git push -q origin "refs/tags/v$NEW"

say "klart: version $NEW"
cat <<EOF

  Release:   https://github.com/Tokke2/Lasfilter/releases/tag/v$NEW
  Uppdatering: https://github.com/Tokke2/Lasfilter/releases/latest/download/updates.json

  Arbetsflödet lägger XPI:n, kontrollsumman och updates.json på releasen
  v$NEW – och på bryggan v1.0.0, som redan installerade kopior läser.
EOF
