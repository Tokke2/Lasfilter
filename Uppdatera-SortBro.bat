@echo off
rem ═══════════════════════════════════════════════════════════════════════════
rem  SortBro – hämta senaste XPI från GitHub
rem
rem  Dubbelklicka på filen. Den hämtar den senaste SortBro-Thunderbird.xpi,
rem  kontrollerar att filen är hel och jämför med den du redan har.
rem
rem  VIKTIGT: filen på disken är bara en fil. Thunderbird läser inte av den av
rem  sig själv – du installerar den med  Tillägg → kugghjulet → Installera
rem  tillägg från fil…
rem
rem  Användning:
rem    Uppdatera-SortBro.bat                  hämtar till skrivbordet
rem    Uppdatera-SortBro.bat "D:\Mina filer"  hämtar till den mappen
rem    Uppdatera-SortBro.bat "" /force        skriver om även om filen är samma
rem ═══════════════════════════════════════════════════════════════════════════
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title SortBro - hamta senaste versionen

set "TAG=v1.0.0"
set "BASE=https://github.com/Tokke2/Lasfilter/raw/%TAG%"
set "XPI=SortBro-Thunderbird.xpi"
set "SUMFILE=SortBro-Thunderbird.xpi.sha256"

if "%~1"=="" (set "DEST=%USERPROFILE%\Desktop") else (set "DEST=%~1")
set "FORCE=0"
if /i "%~2"=="/force" set "FORCE=1"

if not exist "!DEST!\" (
  echo Mappen finns inte: !DEST!
  echo Skapa den, eller ange en annan mapp som argument.
  goto :fail
)

echo.
echo   SortBro - hamtar senaste versionen
echo   -----------------------------------
echo   Till:  !DEST!
echo.

rem ── Hämtaverktyg: curl finns i Windows 10+, annars PowerShell ─────────────
set "DL="
where curl >nul 2>&1 && set "DL=curl"
if not defined DL (
  where powershell >nul 2>&1 && set "DL=powershell"
)
if not defined DL (
  echo Varken curl eller PowerShell hittades. Windows 10 eller senare behovs.
  goto :fail
)

set "TMPXPI=%TEMP%\sortbro-new.xpi"
set "TMPSUM=%TEMP%\sortbro-new.sha256"
del /q "!TMPXPI!" "!TMPSUM!" >nul 2>&1

echo   Hamtar tillaggsfilen...
call :download "%BASE%/%XPI%" "!TMPXPI!"
if errorlevel 1 goto :neterror
if not exist "!TMPXPI!" goto :neterror
for %%A in ("!TMPXPI!") do if %%~zA LSS 1000 goto :neterror

rem ── Är det en riktig XPI? En XPI är en zip och börjar med bokstäverna PK ───
set "MAGIC="
for /f "tokens=* delims=" %%S in ('powershell -NoProfile -Command "$b=[System.IO.File]::ReadAllBytes('!TMPXPI!'); if($b.Length -ge 2 -and $b[0] -eq 80 -and $b[1] -eq 75){'PK'}else{'NEJ'}"') do set "MAGIC=%%S"
if not "!MAGIC!"=="PK" (
  echo Filen som hamtades ar inte ett giltigt tillagg.
  goto :fail
)

rem ── Kontrollsumma: är filen den som publicerats? ──────────────────────────
echo   Kontrollerar filen...
call :hash "!TMPXPI!"
set "GOT=!HASH!"
if not defined GOT (
  echo   OBS: Kunde inte rakna ut kontrollsumman - filen ar hamtad men okontrollerad.
)

call :download "%BASE%/%SUMFILE%" "!TMPSUM!"
set "WANT="
if exist "!TMPSUM!" (
  for /f "tokens=1" %%W in ('type "!TMPSUM!"') do if not defined WANT set "WANT=%%W"
)
if not defined WANT (
  echo   OBS: Kontrollsumman kunde inte hamtas - filen ar hamtad men okontrollerad.
  goto :place
)
if /i not "!GOT!"=="!WANT!" (
  echo.
  echo   STOPP: filen stammer inte med den publicerade kontrollsumman.
  echo     hamtad:    !GOT!
  echo     forvantad: !WANT!
  echo.
  echo   Ingenting har sparats. Forsok igen om en stund, och sag till om det
  echo   upprepas - da ar filen pa GitHub inte den den ska vara.
  goto :fail
)

:place
set "TARGET=!DEST!\%XPI%"
set "SAME=0"
if exist "!TARGET!" (
  call :hash "!TARGET!"
  if /i "!HASH!"=="!GOT!" set "SAME=1"
)

if "!SAME!"=="1" if "!FORCE!"=="0" (
  echo.
  echo   Du har redan den senaste versionen - filen ar oforandrad.
  echo   Kor igen med /force om du vill skriva om den anda.
  goto :done
)

if exist "!TARGET!" (
  set "OLD=!TARGET!.gammal"
  if exist "!OLD!" del /q "!OLD!" >nul 2>&1
  echo   Sparar den gamla filen som .gammal
  move /y "!TARGET!" "!OLD!" >nul 2>&1
)
move /y "!TMPXPI!" "!TARGET!" >nul
if errorlevel 1 (
  echo   Kunde inte skriva filen. Stang Thunderbird om den ligger oppen och forsok igen.
  goto :fail
)
echo.
echo   Klart. Filen ligger har:
echo     !TARGET!

:done
echo.
echo   Kontrollsumma: !GOT!
del /q "!TMPXPI!" "!TMPSUM!" >nul 2>&1
echo.
echo   -- Sa installerar du den ------------------------------------------
echo   1. Oppna Thunderbird.
echo   2. Verktyg ^> Tillagg och teman   (Ctrl+Skift+A)
echo   3. Kugghjulet uppe till hoger ^> "Installera tillagg fran fil..."
echo   4. Valj filen ovan och starta om Thunderbird.
echo.
echo   Reglerna rors inte av en ominstallation.
echo.
start "" "!DEST!"
endlocal
exit /b 0

rem ── Underprogram ──────────────────────────────────────────────────────────
:download
rem  %1 = url, %2 = målfil. Sätter errorlevel 1 vid fel.
if "!DL!"=="curl" (
  curl -L --fail --silent --show-error --max-time 180 -o "%~2" "%~1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -UseBasicParsing -Uri '%~1' -OutFile '%~2' -TimeoutSec 180 } catch { exit 1 }"
)
exit /b %errorlevel%

:hash
rem  %1 = fil. Lägger sha256 i variabeln HASH.
set "HASH="
for /f "tokens=* delims=" %%H in ('powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 -Path '%~1').Hash.ToLower()"') do set "HASH=%%H"
exit /b 0

:neterror
echo.
echo   Kunde inte hamta filen fran GitHub.
echo   Kontrollera natverket och adressen:
echo     %BASE%/%XPI%
goto :fail

:fail
del /q "!TMPXPI!" "!TMPSUM!" >nul 2>&1
echo.
pause
endlocal
exit /b 1
