#!/usr/bin/env bash
# ── SortBro: portabel Python-start för macOS och Linux ──────────────────────
# Lägg filen i appmappen och kör:  bash start_macos_linux.sh
# Allt som skapas hamnar i appmappen. Flyttar du mappen fungerar den nya
# platsen direkt: sökvägen räknas alltid ut från filens egen mapp.
set -u
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE" || exit 1

PY=""
if [ -x "$HERE/.python/bin/python3" ]; then
  PY="$HERE/.python/bin/python3"
elif command -v python3 >/dev/null 2>&1; then
  PY="python3"
elif command -v python >/dev/null 2>&1; then
  PY="python"
fi

if [ -z "$PY" ]; then
  echo "Python hittades inte."
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "Installera med:  brew install python   (eller hämta från https://www.python.org/downloads/)"
  else
    echo "Installera med:  sudo apt install python3 python3-venv   (Debian/Ubuntu)"
    echo "                 sudo dnf install python3                (Fedora)"
  fi
  exit 1
fi

"$PY" "$HERE/pythonstart.py" --run "$@"
status=$?
if [ $status -ne 0 ]; then
  echo
  echo "Något gick fel. Kör \"python3 pythonstart.py --check\" för att se läget."
fi
exit $status
