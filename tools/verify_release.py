#!/usr/bin/env python3
"""Kontrollerar att release-filerna hör ihop innan de publiceras.

Körs av .github/workflows/release-assets.yml och av tools/ship.sh.
Ett tyst fel här betyder att Thunderbird aldrig uppdaterar, så varje
kontroll är hård: den avbryter med felkod 1 i stället för att varna.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADDON_ID = 'lasfilter@lokala-verktyg.invalid'

errors = []


def check(ok, message):
    if not ok:
        errors.append(message)
    print(('OK   ' if ok else 'FEL  ') + message)


manifest = json.loads((ROOT / 'addon' / 'manifest.json').read_text(encoding='utf-8'))
updates = json.loads((ROOT / 'updates.json').read_text(encoding='utf-8'))
version = manifest['version']
gecko = (manifest.get('browser_specific_settings') or manifest.get('applications') or {}).get('gecko') or {}
entry = (updates.get('addons') or {}).get(ADDON_ID) or {}
items = entry.get('updates') or []
item = items[0] if items else {}

xpi = ROOT / 'SortBro-Thunderbird.xpi'
digest = hashlib.sha256(xpi.read_bytes()).hexdigest()
sidecar = (ROOT / 'SortBro-Thunderbird.xpi.sha256').read_text(encoding='utf-8').split()

check(re.fullmatch(r'\d+\.\d+\.\d+', version) is not None,
      f'versionen {version} har tre delar')
check(gecko.get('id') == ADDON_ID, 'tilläggs-id:t är oförändrat')
check(bool(re.fullmatch(r'https://github\.com/Tokke2/Lasfilter/releases/latest/download/updates\.json',
                        gecko.get('update_url', ''))),
      'uppdateringsadressen följer senaste release')
check(item.get('version') == version,
      f'updates.json säger {item.get("version")}, manifestet {version}')
check(item.get('update_hash') == 'sha256:' + digest,
      'update_hash stämmer med XPI-filen')
check(bool(re.fullmatch(r'https://github\.com/Tokke2/Lasfilter/releases/latest/download/SortBro-Thunderbird\.xpi',
                        item.get('update_link', ''))),
      'nedladdningslänken går via senaste release')
check(sidecar and sidecar[0] == digest,
      'kontrollsumman bredvid filen stämmer med XPI-filen')

if errors:
    print(f'\n{len(errors)} fel – inget publiceras.')
    sys.exit(1)
print(f'\nAllt stämmer: version {version}, sha256 {digest}')
