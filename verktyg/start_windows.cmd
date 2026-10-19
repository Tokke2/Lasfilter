@echo off
rem ── SortBro: portabel Python-start för Windows ─────────────────────────────
rem Lägg filen i appmappen (t.ex. D:\Program\ArkivPiloten) och dubbelklicka.
rem Allt som skapas hamnar i appmappen – flyttar du mappen fungerar den nya
rem platsen direkt, eftersom %~dp0 alltid är mappen filen ligger i.
setlocal
cd /d "%~dp0"

set "PY="
if exist "%~dp0.python\python.exe" set "PY=%~dp0.python\python.exe"
if not defined PY (
  where py >nul 2>nul
  if not errorlevel 1 set "PY=py -3"
)
if not defined PY (
  where python >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if not defined PY (
  echo Python hittades inte.
  echo Hamta senaste versionen fran https://www.python.org/downloads/
  echo Kryssa i "Add python.exe to PATH" nar du installerar.
  pause
  exit /b 1
)

%PY% "%~dp0pythonstart.py" --run %*
if errorlevel 1 (
  echo.
  echo Nagot gick fel. Kor "python pythonstart.py --check" for att se laget.
  pause
)
