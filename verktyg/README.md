# Python-start som följer med mappen

Tre filer som gör en Python-app startklar på vilken dator som helst – och som **följer med mappen om du flyttar den**:

| Fil | Vad den gör |
| --- | --- |
| `pythonstart.py` | Sköter allt: hittar Python, skapar miljö i appmappen, installerar paket, startar appen |
| `start_windows.cmd` | Dubbelklickbar start för Windows |
| `start_macos_linux.sh` | Start för macOS och Linux (`bash start_macos_linux.sh`) |
| `start_macos.command` | Dubbelklickbar start för macOS |
| `test_pythonstart.py` | 12 tester, bl.a. att mappen kan flyttas mitt i |

## Så använder du den

1. Kopiera filerna till appmappen – till exempel `D:\Program\ArkivPiloten`, bredvid `pdfsorter.py`.
2. Dubbelklicka `start_windows.cmd` (eller kör `python pythonstart.py --run`).

Första gången skapas `.venv` i appmappen och paketen i `requirements.txt` installeras. Sedan går starten på ett par sekunder.

```bat
python pythonstart.py               :: förbered miljön
python pythonstart.py --run         :: förbered och starta appen
python pythonstart.py --check       :: visa läget, ändra ingenting
python pythonstart.py --check --json
python pythonstart.py --rebuild     :: bygg om miljön från grunden
python pythonstart.py --python      :: var hittar jag senaste Python?
python pythonstart.py --install-python  :: ladda ner installationsfilen till appmappen
```

## Det viktiga: ingenting utanför appmappen

Allt som skapas ligger i appmappen:

| Sökväg | Innehåll |
| --- | --- |
| `.venv/` | appens egen Python-miljö och paketen |
| `.venv/.pythonstart.json` | kvitto: vilken mapp, vilken Python, vilka paket |
| `.setup/` | nedladdad Python-installer, om du kört `--install-python` |
| `.python/` | en egen Python om du valt att lägga en i appmappen |

Skriptet skriver **inget** i registret, **inget** i `%APPDATA%`, **inget** i `~/.local`, och ändrar inte `PATH`. Det installerar aldrig något globalt i systemet.

## Flyttar du mappen?

Bara flytta den – inget mer behöver göras. Skriptet räknar alltid ut appmappen från sin egen placering (`Path(__file__).resolve().parent`), så den nya platsen hittas direkt.

En Python-miljö sparar dock absoluta sökvägar. Därför kontrollerar skriptet varje gång om miljön fortfarande pekar rätt:

* pekar `pyvenv.cfg` på en Python som inte finns kvar → miljön byggs om automatiskt,
* saknas miljöns egen `python` → miljön byggs om,
* kvittot säger en annan mapp än den aktuella → mappen har flyttats och miljön byggs om,
* allt annat → miljön används som den är.

Paketen installeras bara om när `requirements.txt` faktiskt ändrats (jämförs med SHA-256 i kvittot), så en vanlig start rör aldrig nätet.

## Senaste Python

Skriptet kräver **Python 3.10 eller senare** och letar i den här ordningen: en egen Python i appmappen (`.python/`), den som startade skriptet, `py -3`, `python`. Hittas ingen ny nog får du en tydlig instruktion i stället för ett kryptiskt fel.

`--install-python` läser **python.orgs egen fillista** för att hitta den senaste versionen (ingen gissad siffra i koden – bara en känd reservversion om nätet inte svarar), laddar ner installationsfilen **till appmappen** (`.setup/`) och talar om vad du ska göra sedan. Testet `LatestPythonTests` kontrollerar att den högsta versionen vinner och att en för gammal aldrig kan väljas. På Linux hänvisar skriptet till `apt`/`dnf` i stället, eftersom en installation där kräver administratörsrättigheter. Skriptet hämtar aldrig något annat och gör det bara när du själv ber om det.

Vill du ha en Python som bokstavligen flyttar med mappen kan du lägga en portabel Python i `.python/` – skriptet letar där först, före systemets.

## Testerna

```bash
python3 -m unittest -v verktyg/test_pythonstart.py
```

Testerna skapar en tillfällig appmapp, bygger miljön, **flyttar hela mappen** och startar appen igen från den nya platsen – och kontrollerar att inget hamnar utanför appmappen. 17 tester, varav fem för versionsläsningen (helt utan nät).

## Vad som inte ingår

Skriptet registrerar ingen autostart och skapar inga genvägar. Det är medvetet: en genväg i startmenyn innehåller en absolut sökväg och slutar fungera när mappen flyttas. Vill du ha appen startad vid inloggning, lägg en genväg till `start_windows.cmd` i `shell:startup` – och gör om den om du flyttar mappen.
