@echo off
setlocal EnableExtensions
title SortBro - versionskontroll

rem  Kolla-SortBro-version.bat
rem  Jamfor den installerade SortBro-versionen med senaste release pa GitHub.
rem  Skriptet kontrollerar bara. Det laddar inte ner och installerar ingenting.

set "ADDON_ID=lasfilter@lokala-verktyg.invalid"
set "LATEST_JSON=https://github.com/Tokke2/Lasfilter/releases/latest/download/updates.json"
set "PAGE=https://github.com/Tokke2/Lasfilter/releases/latest"
set "TMP1=%TEMP%\sortbro-installed.txt"
set "TMP2=%TEMP%\sortbro-latest.txt"

echo.
echo  SortBro - finns det en nyare version?
echo  ====================================
echo.

if not defined APPDATA goto noappdata

del "%TMP1%" >nul 2>nul
for /d %%P in ("%APPDATA%\Thunderbird\Profiles\*") do (
  if not exist "%TMP1%" (
    if exist "%%~fP\extensions\%ADDON_ID%.xpi" (
      powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('%%~fP\extensions\%ADDON_ID%.xpi'); $e=$z.GetEntry('manifest.json'); $t=(New-Object System.IO.StreamReader($e.Open())).ReadToEnd(); $o=ConvertFrom-Json -InputObject $t; $a='nej'; if($o.browser_specific_settings.gecko.update_url -or $o.applications.gecko.update_url){$a='ja'}; Write-Output ($o.version + '|' + $a); $z.Dispose()" > "%TMP1%" 2>nul
    ) else if exist "%%~fP\extensions\%ADDON_ID%\manifest.json" (
      powershell -NoProfile -ExecutionPolicy Bypass -Command "$o=ConvertFrom-Json -InputObject (Get-Content '%%~fP\extensions\%ADDON_ID%\manifest.json' -Raw); $a='nej'; if($o.browser_specific_settings.gecko.update_url -or $o.applications.gecko.update_url){$a='ja'}; Write-Output ($o.version + '|' + $a)" > "%TMP1%" 2>nul
    )
  )
)

if not exist "%TMP1%" goto notinstalled
for /f "usebackq tokens=1,2 delims=|" %%a in ("%TMP1%") do (
  set "INSTALLED=%%a"
  set "AUTOUPD=%%b"
)
if not defined INSTALLED goto notinstalled

echo  Kontrollerar GitHub ...
del "%TMP2%" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%LATEST_JSON%' -OutFile '%TEMP%\sortbro-updates.json'; $o=ConvertFrom-Json -InputObject (Get-Content '%TEMP%\sortbro-updates.json' -Raw); Write-Output $o.addons.'lasfilter@lokala-verktyg.invalid'.updates[0].version" > "%TMP2%" 2>nul

set "LATESTV="
if exist "%TMP2%" for /f "usebackq delims=" %%a in ("%TMP2%") do if not defined LATESTV set "LATESTV=%%a"
if not defined LATESTV goto nonetwork

call :tonum "%INSTALLED%" INUM
call :tonum "%LATESTV%" LNUM
if not defined INUM goto notinstalled
if not defined LNUM goto nonetwork

echo.
echo  Installerad:  %INSTALLED%
echo  Senaste:      %LATESTV%
echo.

if %LNUM% GTR %INUM% goto newer
if %LNUM% LSS %INUM% goto newerinstalled

echo  Du har senaste versionen.
goto end

:newer
echo  Det finns en nyare version.
echo.
if "%AUTOUPD%"=="ja" (
  echo  Din installation har automatisk uppdatering. Thunderbird
  echo  kontrollerar varje dygn och uppdaterar automatiskt.
) else (
  echo  Din installation har ingen automatisk uppdatering. Ladda ner
  echo  filen och installera den som vanligt - utan att avinstallera.
)
echo.
echo  Ladda ner: %PAGE%
echo.
choice /c JN /n /m "  Visa nedladdningssidan nu? [J/N] "
if errorlevel 2 goto end
if errorlevel 1 start "" "%PAGE%"
goto end

:newerinstalled
echo  Din installerade version ar nyare an senaste release (provbygge?).
goto end

:notinstalled
echo  Hittar ingen installerad SortBro i Thunderbird-profilen.
echo.
echo  Ar tillagget installerat i en annan profil, eller ar det har
echo  en annan dator sa finns filen har: %PAGE%
goto end

:noappdata
echo  APPDATA saknas. Skriptet maste kora i en vanlig Windows-session.
goto end

:nonetwork
echo  Kunde inte kontakta GitHub. Kontrollera anslutningen och kor igen.
goto end

:end
echo.
pause
goto :eof

:tonum
set "N1=0"
set "N2=0"
set "N3=0"
for /f "tokens=1,2,3 delims=." %%a in ("%~1") do (
  set "N1=%%a"
  if not "%%b"=="" set "N2=%%b"
  if not "%%c"=="" set "N3=%%c"
)
set /a %~2=1000000*N1+1000*N2+N3
goto :eof
