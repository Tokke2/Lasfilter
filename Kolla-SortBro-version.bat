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
set "TMP3=%TEMP%\sortbro-profile.txt"
set "TMP4=%TEMP%\sortbro-lastcheck.txt"

echo.
echo  SortBro - finns det en nyare version?
echo  ====================================
echo.

if not defined APPDATA goto noappdata

del "%TMP1%" >nul 2>nul
del "%TMP3%" >nul 2>nul
for /d %%P in ("%APPDATA%\Thunderbird\Profiles\*") do (
  if not exist "%TMP1%" (
    if exist "%%~fP\extensions\%ADDON_ID%.xpi" (
      > "%TMP3%" echo %%~fP
      powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('%%~fP\extensions\%ADDON_ID%.xpi'); $e=$z.GetEntry('manifest.json'); $t=(New-Object System.IO.StreamReader($e.Open())).ReadToEnd(); $o=ConvertFrom-Json -InputObject $t; $a='nej'; if($o.browser_specific_settings.gecko.update_url -or $o.applications.gecko.update_url){$a='ja'}; Write-Output ($o.version + '|' + $a); $z.Dispose()" > "%TMP1%" 2>nul
    ) else if exist "%%~fP\extensions\%ADDON_ID%\manifest.json" (
      > "%TMP3%" echo %%~fP
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

rem  Nar letade Thunderbird senast efter en ny version, och ar den
rem  automatiska hamtningen pa? Det star i profilens prefs.js.
set "PROFILE="
set "DIAG="
set "AUTO="
if exist "%TMP3%" for /f "usebackq delims=" %%p in ("%TMP3%") do set "PROFILE=%%p"
del "%TMP4%" >nul 2>nul
if defined PROFILE if exist "%PROFILE%\prefs.js" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$f='%PROFILE%\prefs.js'; $dt='aldrig'; $m=Select-String -Path $f -Pattern 'lastUpdateTime\.addon-background-update-timer[\x22],\s*(\d+)' -ErrorAction SilentlyContinue | Select-Object -First 1; if($m){$t=[int64]$m.Matches[0].Groups[1].Value; $w=(Get-Date '1970-01-01T00:00:00Z').ToLocalTime().AddSeconds($t); $ago=[int](((Get-Date)-$w).TotalMinutes); if($ago -lt 0){$ago=0}; $rest=1440-$ago; if($rest -lt 0){$rest=0}; $dt=$w.ToString('yyyy-MM-dd HH:mm')+'  /  '+[int]($ago/60)+' tim sedan  /  nasta om ca '+[int]($rest/60)+' tim'}; $au='ja'; if(Select-String -Path $f -Pattern 'extensions.autoUpdate[\x22],\s*false' -Quiet -ErrorAction SilentlyContinue){$au='NEJ'}; Write-Output ('  Senaste kontrollen:  '+$dt); Write-Output $au" > "%TMP4%" 2>nul
  if exist "%TMP4%" for /f "usebackq delims=" %%a in ("%TMP4%") do if not defined DIAG set "DIAG=%%a"
  if exist "%TMP4%" for /f "usebackq skip=1 delims=" %%a in ("%TMP4%") do if not defined AUTO set "AUTO=%%a"
)

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
if defined DIAG echo %DIAG%
if "%AUTO%"=="NEJ" echo  Automatisk hamtning:  AV i Thunderbird
echo.

if %LNUM% GTR %INUM% goto newer
if %LNUM% LSS %INUM% goto newerinstalled

echo  Du har senaste versionen.
goto end

:newer
echo  Det finns en nyare version.
echo.
if "%AUTOUPD%"=="ja" (
  echo  Din installation uppdaterar sig sjalv - ingenting att gora.
  echo  Thunderbird letar vid start och sedan en gang i dygnet, och
  echo  SortBro startar om sig sjalv nar filen val ar hamtad.
) else (
  echo  Din installation har ingen automatisk uppdatering. Ladda ner
  echo  filen och installera den som vanligt - utan att avinstallera.
)
if "%AUTO%"=="NEJ" (
  echo.
  echo  OBS: automatisk hamtning av tillaggsuppdateringar ar AV i Thunderbird,
  echo  sa ingen ny version laddas ner forran du sjalv soker.
)
echo.
echo  Vill du ha den med en gang: Tillagg och teman, Ctrl+Skift+A,
echo  kugghjulet uppe till hoger, Sok efter uppdateringar.
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
  set "N2=%%b"
  set "N3=%%c"
)
if not defined N1 set "N1=0"
if not defined N2 set "N2=0"
if not defined N3 set "N3=0"
set /a %~2=1000000*N1+1000*N2+N3
goto :eof
