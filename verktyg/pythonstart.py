#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pythonstart.py – portabel Python-start för en appmapp.

Lägg den här filen i appmappen (t.ex. D:\\Program\\ArkivPiloten) och kör den.
Den sköter allt som behövs för att appen ska starta, och den följer med mappen
om du flyttar den:

  * letar upp en Python som är ny nog (3.10 eller senare),
  * skapar en egen miljö i appmappen (.venv) i stället för att röra systemets Python,
  * installerar/uppdaterar paketen från requirements.txt – bara när filen ändrats,
  * upptäcker att mappen flyttats (miljön pekar då på gamla sökvägar) och bygger om den,
  * startar appens huvudfil med miljöns Python.

Ingenting skrivs utanför appmappen: inga registervärden, ingen PATH-ändring,
inget i %APPDATA% eller ~/.local. Flyttar du mappen fungerar allt direkt igen.

Exempel:
  python pythonstart.py                 # förbered miljön
  python pythonstart.py --run           # förbered och starta appen
  python pythonstart.py --check         # visa bara vad som gäller (ändrar inget)
  python pythonstart.py --check --json  # samma sak, maskinläsbart
  python pythonstart.py --python        # var hittar jag senaste Python?
  python pythonstart.py --install-python  # ladda ner en egen Python till appmappen (Windows)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

MIN_VERSION = (3, 10)
VENV_DIR = ".venv"
SETUP_DIR = ".setup"
LOCAL_PYTHON_DIR = ".python"
REQUIREMENTS = "requirements.txt"
VENV_MARKER = ".pythonstart.json"

# Huvudfilen letas upp i den här ordningen. Lägg din egen först om du vill.
ENTRY_CANDIDATES = ("main.py", "app.py", "pdfsorter.py", "start.py", "run.py")


# ── Grunden: allt utgår från filens egen mapp ───────────────────────────────

def app_dir() -> Path:
    """Appmappen = mappen där det här skriptet ligger.

    Path.resolve() följer symboliska länkar och ger den verkliga sökvägen, så
    svaret blir rätt även om mappen flyttats eller nås via en genväg.
    """
    return Path(__file__).resolve().parent


def inside_app(path: Path, base: Path | None = None) -> bool:
    """Sant om sökvägen ligger i appmappen (eller är appmappen själv)."""
    base = (base or app_dir()).resolve()
    try:
        Path(path).resolve().relative_to(base)
        return True
    except ValueError:
        return False


def venv_dir(base: Path | None = None) -> Path:
    return (base or app_dir()) / VENV_DIR


def venv_python(base: Path | None = None) -> Path:
    """Sökvägen till miljöns Python – olika mapp på Windows och Unix."""
    v = venv_dir(base)
    if os.name == "nt":
        return v / "Scripts" / "python.exe"
    return v / "bin" / "python3"


# ── Hitta en Python som duger ──────────────────────────────────────────────

def version_of(exe: str | os.PathLike[str]) -> tuple[int, ...] | None:
    """Kör en tolk med --version och läs ut siffrorna. Ingen tolk, inget svar."""
    try:
        out = subprocess.run(
            [str(exe), "-c", "import sys;print('%d.%d.%d' % sys.version_info[:3])"],
            capture_output=True, text=True, timeout=20,
        )
        if out.returncode != 0:
            return None
        return tuple(int(x) for x in out.stdout.strip().split("."))
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def version_text(v: tuple[int, ...] | None) -> str:
    return ".".join(str(x) for x in v) if v else "saknas"


def candidate_interpreters(base: Path | None = None) -> list[str]:
    """Alla tänkbara tolkar, i den ordning de är värda att prova."""
    base = base or app_dir()
    found: list[str] = []
    local = base / LOCAL_PYTHON_DIR
    if os.name == "nt":
        found.append(str(local / "python.exe"))
    else:
        found.append(str(local / "bin" / "python3"))
    found.append(sys.executable)  # den som kör det här skriptet
    if os.name == "nt":
        found += ["py", "python"]
    else:
        found += ["python3", "python"]
    seen, unique = set(), []
    for exe in found:
        if not exe or exe in seen:
            continue
        seen.add(exe)
        unique.append(exe)
    return unique


def find_python(base: Path | None = None) -> tuple[str | None, tuple[int, ...] | None]:
    """Första tolken som är ny nog. (None, None) om ingen finns."""
    for exe in candidate_interpreters(base):
        if os.sep in exe or (os.altsep and os.altsep in exe):
            if not Path(exe).exists():
                continue
        v = version_of(exe)
        if v and v[:2] >= MIN_VERSION:
            return exe, v
    return None, None


# ── Följer mappen: upptäck en miljö som pekar fel ─────────────────────────

def read_venv_home(base: Path | None = None) -> str:
    """Läs 'home' ur pyvenv.cfg – bas-Pythonens mapp när miljön skapades."""
    cfg = venv_dir(base) / "pyvenv.cfg"
    try:
        for line in cfg.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.lower().startswith("home"):
                return line.split("=", 1)[1].strip()
    except OSError:
        return ""
    return ""


def venv_is_stale(base: Path | None = None) -> tuple[bool, str]:
    """Är miljön oanvändbar, t.ex. för att mappen flyttats?

    En venv sparar absoluta sökvägar. Flyttar man appmappen pekar de på platser
    som inte finns längre, och då måste miljön byggas om. Vi kontrollerar tre
    saker: att python-körfilen finns, att bas-Python finns kvar och att miljön
    ligger där den ska.
    """
    base = base or app_dir()
    v = venv_dir(base)
    if not v.exists():
        return False, "ingen miljö än"
    home = read_venv_home(base)
    if not home:
        return True, "miljön saknar pyvenv.cfg"
    if not Path(home).exists():
        return True, "miljön pekar på en Python som inte finns kvar"
    exe = venv_python(base)
    if not exe.exists():
        return True, "miljöns python saknas"
    if not inside_app(v, base):
        return True, "miljön ligger utanför appmappen"
    return False, "miljön är hel"


def venv_state_path(base: Path | None = None) -> Path:
    return venv_dir(base) / VENV_MARKER


def read_state(base: Path | None = None) -> dict:
    try:
        return json.loads(venv_state_path(base).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def write_state(data: dict, base: Path | None = None) -> None:
    """Skriv ett litet kvitto i miljön: vilken mapp, vilken Python, vilka paket."""
    base = base or app_dir()
    payload = dict(data)
    # Anroparen kan ange app_dir själv (t.ex. i ett test); annars gäller den här mappen.
    payload.setdefault("app_dir", str(base.resolve()))
    payload["python"] = sys.version.split()[0]
    payload["platform"] = platform.platform()
    try:
        venv_state_path(base).parent.mkdir(parents=True, exist_ok=True)
        venv_state_path(base).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def moved_since_last_run(base: Path | None = None) -> bool:
    """Har appmappen flyttats sedan miljön skapades?"""
    base = base or app_dir()
    state = read_state(base)
    recorded = state.get("app_dir", "")
    if not recorded:
        return False
    try:
        return Path(recorded).resolve() != base.resolve()
    except OSError:
        return True


# ── Paketen: bara när requirements.txt ändrats ────────────────────────────

def requirements_path(base: Path | None = None) -> Path:
    return (base or app_dir()) / REQUIREMENTS


def requirements_hash(base: Path | None = None) -> str:
    p = requirements_path(base)
    try:
        return hashlib.sha256(p.read_bytes()).hexdigest()
    except OSError:
        return ""


def installed_hash(base: Path | None = None) -> str:
    return str(read_state(base).get("requirements_sha256", ""))


def packages_need_update(base: Path | None = None) -> bool:
    current = requirements_hash(base)
    if not current:
        return False  # ingen requirements.txt = inget att installera
    return current != installed_hash(base)


# ── Starta appen ──────────────────────────────────────────────────────────

def discover_entry(base: Path | None = None) -> Path | None:
    """Hitta appens huvudfil. Den ligger alltid i appmappen, aldrig utanför."""
    base = base or app_dir()
    for name in ENTRY_CANDIDATES:
        p = base / name
        if p.is_file() and inside_app(p, base):
            return p
    return None


# ── Nedladdning av Python (bara när man ber om det) ───────────────────────

PYTHON_FTP_INDEX = "https://www.python.org/ftp/python/"
# Används bara om listningen inte går att nå – en känd, stabil version.
FALLBACK_VERSION = "3.13.0"


def python_download_page() -> str:
    return "https://www.python.org/downloads/"


def newest_version_from_index(html: str) -> str:
    """Läs ut senaste 3.x.y ur python.orgs fil-listning.

    Listningen innehåller rader som href="3.13.2/". Vi tar den högsta versionen
    som är 3.10 eller senare, så att en gammal post inte kan vinna.
    """
    best: tuple[int, ...] = ()
    for m in re.finditer(r'href="3\.(\d{1,2})\.(\d{1,2})/?["/]', html or ""):
        v = (3, int(m.group(1)), int(m.group(2)))
        if v[:2] >= MIN_VERSION and v > best:
            best = v
    return ".".join(str(x) for x in best) if best else ""


def latest_installer_url(version: str, system: str | None = None) -> str:
    """Adressen till installationsfilen för en viss version och ett visst system."""
    system = system or platform.system()
    base = PYTHON_FTP_INDEX + version + "/"
    if system == "Windows":
        return base + "python-" + version + "-amd64.exe"
    if system == "Darwin":
        return base + "python-" + version + "-macos11.pkg"
    return ""


def fetch_newest_version(timeout: float = 15.0) -> str:
    """Fråga python.org vilken den senaste versionen är. Tom sträng om nätet saknas."""
    import urllib.request

    try:
        with urllib.request.urlopen(PYTHON_FTP_INDEX, timeout=timeout) as response:  # noqa: S310
            html = response.read().decode("utf-8", "replace")
        return newest_version_from_index(html)
    except Exception:
        return ""


def latest_python_hint() -> str:
    """En ärlig upplysning: vi gissar aldrig en version, vi hänvisar till sidan."""
    return (
        "Senaste Python finns på " + python_download_page() + " – välj versionen för "
        + platform.system() + " och kryssa i 'Add python.exe to PATH' vid installation."
    )


def download_python_installer(base: Path | None = None) -> Path | None:
    """Ladda ner Python-installern till appmappen (.setup/).

    Vi hämtar alltid sidan för att hitta rätt fil i stället för att gissa ett
    versionsnummer – men bara när användaren själv kört --install-python.
    """
    import urllib.request

    base = base or app_dir()
    setup = base / SETUP_DIR
    if not inside_app(setup, base):
        raise SystemExit("Vägrar skriva utanför appmappen: " + str(setup))
    setup.mkdir(exist_ok=True)
    system = platform.system()
    if system not in ("Windows", "Darwin"):
        print("På Linux installeras Python med systemets pakethanterare, inte här.")
        print("  Debian/Ubuntu:  sudo apt install python3 python3-venv python3-pip")
        print("  Fedora:         sudo dnf install python3 python3-pip")
        return None
    # Fråga python.org vilken version som är den senaste; gissa aldrig.
    version = fetch_newest_version()
    if version:
        print("Senaste Python hos python.org: " + version)
    else:
        version = FALLBACK_VERSION
        print("Kunde inte läsa listan hos python.org – använder kända versionen " + version)
        print(latest_python_hint())
    suffix = "python-installer.exe" if system == "Windows" else "python-installer.pkg"
    target = setup / suffix
    url = latest_installer_url(version, system)
    if not url:
        print(latest_python_hint())
        return None
    try:
        print("Hämtar " + url)
        urllib.request.urlretrieve(url, target)  # noqa: S310 – adressen är fast
    except Exception as err:  # nätet kan alltid strula
        print("Kunde inte ladda ner Python: " + str(err))
        print(latest_python_hint())
        return None
    if os.name == "nt":
        print("Installeraren ligger i " + str(target) + ". Kör den och välj samma mapp som appen")
        print("om du vill ha en Python som följer med mappen. Annars räcker en vanlig installation.")
    else:
        print("Installationsfilen ligger i " + str(target) + ". Öppna den och följ guiden.")
    return target


# ── Miljön: skapa, laga, uppdatera ────────────────────────────────────────

def run(cmd: list[str], *, quiet: bool = False) -> int:
    if not quiet:
        print("  " + " ".join(cmd))
    return subprocess.call(cmd)


def ensure_venv(base: Path | None = None, *, check_only: bool = False, rebuild: bool = False) -> tuple[bool, str]:
    """Skapa eller laga miljön. Returnerar (ok, förklaring)."""
    base = base or app_dir()
    stale, why = venv_is_stale(base)
    if rebuild and venv_dir(base).exists():
        stale, why = True, "ombedd att byggas om"
    if stale:
        if check_only:
            return False, "miljön måste byggas om (" + why + ")"
        print("Bygger om miljön: " + why)
        shutil.rmtree(venv_dir(base), ignore_errors=True)

    if not venv_dir(base).exists():
        exe, ver = find_python(base)
        if not exe:
            return False, "hittade ingen Python " + version_text(MIN_VERSION) + " eller nyare"
        if check_only:
            return False, "miljön saknas (skulle skapas med Python " + version_text(ver) + ")"
        print("Skapar miljö i " + str(venv_dir(base)) + " med Python " + version_text(ver) + " (" + exe + ")")
        code = run([exe, "-m", "venv", str(venv_dir(base))])
        if code != 0:
            return False, "kunde inte skapa miljön (felkod " + str(code) + ")"
        why = "skapad med Python " + version_text(ver)
    if check_only:
        return True, why
    write_state({"created": True}, base)
    return True, why


def ensure_packages(base: Path | None = None, *, check_only: bool = False) -> tuple[bool, str]:
    base = base or app_dir()
    req = requirements_path(base)
    if not req.exists():
        return True, "ingen " + REQUIREMENTS + " – inget att installera"
    if packages_need_update(base):
        if check_only:
            return False, "paketen behöver uppdateras"
        print("Installerar paket från " + REQUIREMENTS)
        py = venv_python(base)
        code = run([str(py), "-m", "pip", "install", "--upgrade", "pip"], quiet=True)
        if code != 0:
            return False, "kunde inte uppdatera pip"
        code = run([str(py), "-m", "pip", "install", "-r", str(req)])
        if code != 0:
            return False, "paketen kunde inte installeras"
        write_state({"requirements_sha256": requirements_hash(base)}, base)
        return True, "paketen installerades"
    return True, "paketen är redan installerade"


def status(base: Path | None = None) -> dict:
    """Allt gränssnittet eller --check behöver veta, utan att ändra något."""
    base = base or app_dir()
    exe, ver = find_python(base)
    stale, why = venv_is_stale(base)
    entry = discover_entry(base)
    return {
        "app_dir": str(base.resolve()),
        "python": ver,
        "python_text": version_text(ver),
        "python_exe": exe,
        "min_version": ".".join(str(x) for x in MIN_VERSION),
        "venv": str(venv_dir(base)),
        "venv_exists": venv_dir(base).exists(),
        "venv_stale": stale,
        "venv_note": why,
        "moved": moved_since_last_run(base),
        "requirements": requirements_path(base).exists(),
        "requirements_changed": packages_need_update(base),
        "entry": str(entry) if entry else "",
        "all_inside_app": all(inside_app(p, base) for p in (venv_dir(base), base / SETUP_DIR, base / LOCAL_PYTHON_DIR)),
    }


def prepare(base: Path | None = None, *, check_only: bool = False, rebuild: bool = False) -> int:
    base = base or app_dir()
    print("Appmapp: " + str(base.resolve()))
    if moved_since_last_run(base):
        print("Mappen har flyttats sedan förra körningen – allt byggs om på nya platsen.")
        rebuild = True
    ok, why = ensure_venv(base, check_only=check_only, rebuild=rebuild)
    print("Miljö: " + why)
    if not ok:
        if "ingen Python" in why:
            print(latest_python_hint())
        return 1
    ok2, why2 = ensure_packages(base, check_only=check_only)
    print("Paket: " + why2)
    return 0 if ok2 else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Portabel Python-start som följer med appmappen.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--run", nargs=argparse.REMAINDER, metavar="FIL",
                        help="starta appens huvudfil (standard: hitta den automatiskt)")
    parser.add_argument("--check", action="store_true", help="visa bara läget, ändra ingenting")
    parser.add_argument("--json", action="store_true", help="skriv läget som JSON (med --check)")
    parser.add_argument("--rebuild", action="store_true", help="bygg om miljön från grunden")
    parser.add_argument("--install-python", action="store_true", help="ladda ner en Python-installer till appmappen")
    parser.add_argument("--python", action="store_true", help="visa var senaste Python finns")
    args = parser.parse_args(argv)

    base = app_dir()

    if args.python:
        print(latest_python_hint())
        exe, ver = find_python(base)
        print("Hittad Python här: " + version_text(ver) + (" (" + exe + ")" if exe else " (ingen)"))
        return 0

    if args.install_python:
        return 0 if download_python_installer(base) else 1

    if args.check:
        info = status(base)
        if args.json:
            print(json.dumps(info, ensure_ascii=False, indent=2))
        else:
            print("Appmapp:      " + info["app_dir"])
            print("Python:       " + info["python_text"] + (" (kräver " + info["min_version"] + "+)" if info["python"] else ""))
            print("Miljö:        " + ("finns" if info["venv_exists"] else "saknas") + (" – " + info["venv_note"] if info["venv_note"] else ""))
            print("Flyttad:      " + ("ja" if info["moved"] else "nej"))
            print("Paket:        " + ("behöver uppdateras" if info["requirements_changed"] else "aktuella"))
            print("Huvudfil:     " + (info["entry"] or "hittades inte"))
            print("Inom appmappen: " + ("ja" if info["all_inside_app"] else "NEJ"))
        return 0

    code = prepare(base, rebuild=args.rebuild)
    if code != 0:
        return code

    if args.run is not None:
        base = app_dir()
        if args.run:
            target = (base / args.run[0]).resolve()
            if not inside_app(target, base):
                print("Vägrar starta en fil utanför appmappen: " + str(target))
                return 2
            rest = args.run[1:]
        else:
            found = discover_entry(base)
            if not found:
                print("Hittade ingen huvudfil i " + str(base) + " (" + ", ".join(ENTRY_CANDIDATES) + ").")
                return 2
            target, rest = found, []
        py = venv_python(base)
        print("Startar " + target.name)
        return subprocess.call([str(py), str(target), *rest])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
