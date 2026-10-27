@echo off
setlocal EnableExtensions
title SortBro - uppdatera

rem  Uppdatera-SortBro.bat
rem  Hamtar senaste SortBro fran GitHub Releases och lagger in den i
rem  Thunderbird-profilen. Dubbelklicka pa filen.
rem
rem    Uppdatera-SortBro.bat          uppdaterar direkt, fragar inget
rem    Uppdatera-SortBro.bat /tyst    inga fragor, for schemalaggning
rem    Uppdatera-SortBro.bat /kolla   jamfor bara, andra ingenting
rem
rem  Skriptet jamfor versioner, laddar ner, kontrollsummar och byter ut
rem  en fil i profilen. Det skriver aldrig i Thunderbirds databas - det
rem  gor Thunderbird sjalv vid start.

set "ADDON_ID=lasfilter@lokala-verktyg.invalid"
set "LATEST_JSON=https://github.com/Tokke2/Lasfilter/releases/latest/download/updates.json"
set "PAGE=https://github.com/Tokke2/Lasfilter/releases/latest"
set "WORK=%TEMP%\sortbro-uppdatering"
set "NEW=%WORK%\SortBro-Thunderbird.xpi"

set "SILENT=0"
if /i "%~1"=="/tyst" set "SILENT=1"
set "CHECKONLY=0"
if /i "%~1"=="/kolla" set "CHECKONLY=1"

if not "%SILENT%"=="0" goto tyststart
echo.
echo  SortBro - uppdatera
echo  ===================
echo.
:tyststart

if not defined APPDATA goto noappdata
if not exist "%WORK%" mkdir "%WORK%" >nul 2>nul
if not exist "%WORK%" goto notemp

rem  ---------- 1. hitta profilen och den version Thunderbird anvander
set "PROFILE="
set "INSTALLED="
set "LOC="
set "XPIFILE="
for /d %%P in ("%APPDATA%\Thunderbird\Profiles\*") do call :las_profil "%%~fP"
if not defined INSTALLED goto notinstalled

rem  ---------- 2. fraga GitHub vilken som ar senaste
if "%SILENT%"=="0" echo  Kontrollerar GitHub ...
del "%WORK%\latest.txt" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try{ Invoke-WebRequest -UseBasicParsing -Uri '%LATEST_JSON%' -OutFile '%WORK%\updates.json' -ErrorAction Stop; $o=ConvertFrom-Json -InputObject (Get-Content '%WORK%\updates.json' -Raw); $u=$o.addons.'%ADDON_ID%'.updates[0]; $h=$u.update_hash -replace '^sha256:',''; Write-Output ($u.version + '|' + $u.update_link + '|' + $h) }catch{ Write-Output 'FEL' }" > "%WORK%\latest.txt" 2>nul

set "LATESTV="
set "LINK="
set "HASHEX="
if exist "%WORK%\latest.txt" for /f "usebackq tokens=1,2,3 delims=|" %%a in ("%WORK%\latest.txt") do (
  set "LATESTV=%%a"
  set "LINK=%%b"
  set "HASHEX=%%c"
)
if not defined LATESTV goto nonetwork
if "%LATESTV%"=="FEL" goto nonetwork

call :tonum "%INSTALLED%" INUM
call :tonum "%LATESTV%" LNUM
if not defined INUM goto notinstalled
if not defined LNUM goto nonetwork

if "%SILENT%"=="0" echo.
if "%SILENT%"=="0" echo  Installerad:  %INSTALLED%
if "%SILENT%"=="0" echo  Senaste:      %LATESTV%
if "%SILENT%"=="0" call :las_auto
if "%SILENT%"=="0" echo  Automatik:    %AUTOTEXT%
if "%SILENT%"=="0" if "%AUTOSTATE%"=="off" echo  Sla pa den i Tillagg och teman - eller kor den har filen nar du vill.
if "%SILENT%"=="0" echo.

if %LNUM% GTR %INUM% goto nyare
if "%SILENT%"=="0" echo  Du har senaste versionen.
set "RESULT=senaste"
goto slut_ok

:nyare
if "%CHECKONLY%"=="1" goto visa_bara
if "%SILENT%"=="0" echo  Det finns en nyare version.
if "%SILENT%"=="0" echo  Uppdaterar %INSTALLED% till %LATESTV% ...

rem  ---------- 3. ladda ner och kontrollsumma innan nagot byts ut
del "%NEW%" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try{ Invoke-WebRequest -UseBasicParsing -Uri '%LINK%' -OutFile '%NEW%' -ErrorAction Stop; $f=Get-Item '%NEW%'; if($f.Length -lt 20000){ Write-Output 'TRASIG'; exit 2 }; $h=(Get-FileHash '%NEW%' -Algorithm SHA256).Hash.ToLower(); if($h -ne '%HASHEX%'){ Write-Output 'HASH'; exit 3 }; Write-Output ('OK ' + [int]($f.Length/1024) + ' kB') }catch{ Write-Output 'FEL'; exit 1 }" > "%WORK%\download.txt" 2>&1
set "DL="
if exist "%WORK%\download.txt" for /f "usebackq delims=" %%a in ("%WORK%\download.txt") do if not defined DL set "DL=%%a"
set "DLHEAD="
if defined DL set "DLHEAD=%DL:~0,2%"
if not "%DLHEAD%"=="OK" goto downloadfel
if "%SILENT%"=="0" echo  Nedladdning:   %DL%

rem  ---------- 4. en uppackad installation kan vi inte byta ut
if not defined XPIFILE goto uppackad
if /i not "%LOC%"=="app-profile" goto annanplats

rem  ---------- 5. Thunderbird maste vara stangt nar filen byts
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-Process thunderbird -ErrorAction SilentlyContinue; if(-not $p){ Write-Output 'REDAN'; exit 0 }; $p | ForEach-Object { $_.CloseMainWindow() | Out-Null }; for($i=0; $i -lt 12; $i++){ Start-Sleep -Milliseconds 1000; if(-not (Get-Process thunderbird -ErrorAction SilentlyContinue)){ Write-Output 'STANGD'; exit 0 } }; Write-Output 'KOR'; exit 1" > "%WORK%\close.txt" 2>nul
set "CLOSED="
if exist "%WORK%\close.txt" for /f "usebackq delims=" %%a in ("%WORK%\close.txt") do if not defined CLOSED set "CLOSED=%%a"
if not defined CLOSED set "CLOSED=OKANT"
if "%CLOSED%"=="KOR" goto tbkor
if "%SILENT%"=="0" if not "%CLOSED%"=="OKANT" echo  Thunderbird:    stangt

rem  ---------- 6. kopia forst, sedan byte
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{ $bak=Join-Path '%PROFILE%' 'Lasfilter\Backup'; New-Item -ItemType Directory -Force -Path $bak -ErrorAction Stop | Out-Null; $safety=Join-Path $bak ('SortBro-' + '%INSTALLED%' + '.xpi'); Copy-Item -LiteralPath '%XPIFILE%' -Destination $safety -Force -ErrorAction Stop; Start-Sleep -Seconds 2; $tmp='%XPIFILE%' + '.ny'; Copy-Item -LiteralPath '%NEW%' -Destination $tmp -Force -ErrorAction Stop; Move-Item -LiteralPath $tmp -Destination '%XPIFILE%' -Force -ErrorAction Stop; $v=(Get-FileHash '%XPIFILE%' -Algorithm SHA256).Hash.ToLower(); if($v -ne '%HASHEX%'){ Copy-Item -LiteralPath $safety -Destination '%XPIFILE%' -Force; Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue; throw 'summan stamde inte' }; Get-ChildItem $bak -Filter 'SortBro-*.xpi' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force; Write-Output 'OK' }catch{ Write-Output 'FEL'; exit 1 }" > "%WORK%\swap.txt" 2>&1
set "SWAPPED="
if exist "%WORK%\swap.txt" for /f "usebackq delims=" %%a in ("%WORK%\swap.txt") do if not defined SWAPPED set "SWAPPED=%%a"
if not "%SWAPPED%"=="OK" goto swapfel
if "%SILENT%"=="0" echo  Filen:         utbytt, kopia sparad

rem  ---------- 7. starta Thunderbird och se om den tar den nya versionen
powershell -NoProfile -ExecutionPolicy Bypass -Command "$exe=$null; try{ $exe=(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\thunderbird.exe' -ErrorAction Stop).'(default)' }catch{}; if(-not $exe -or -not (Test-Path $exe)){ $exe=$null; $c1=Join-Path $env:ProgramFiles 'Mozilla Thunderbird\thunderbird.exe'; $c2=Join-Path ${env:ProgramFiles(x86)} 'Mozilla Thunderbird\thunderbird.exe'; foreach($c in @($c1,$c2)){ if(Test-Path $c){ $exe=$c; break } } }; if(-not $exe){ Write-Output 'SAKNAS'; exit 1 }; Start-Process $exe; Write-Output 'STARTAD'" > "%WORK%\start.txt" 2>nul
set "STARTED="
if exist "%WORK%\start.txt" for /f "usebackq delims=" %%a in ("%WORK%\start.txt") do if not defined STARTED set "STARTED=%%a"
if not "%STARTED%"=="STARTAD" goto startfel
if "%SILENT%"=="0" echo  Thunderbird:    startat

powershell -NoProfile -ExecutionPolicy Bypass -Command "$j=Join-Path '%PROFILE%' 'extensions.json'; for($i=0; $i -lt 6; $i++){ Start-Sleep -Seconds 10; try{ $d=ConvertFrom-Json -InputObject (Get-Content $j -Raw -ErrorAction Stop); $a=$d.addons | Where-Object {$_.id -eq '%ADDON_ID%'} | Select-Object -First 1; if($a -and $a.version -eq '%LATESTV%'){ Write-Output 'AKTIV'; exit 0 } }catch{} }; Write-Output 'INTE-AKTIV'" > "%WORK%\verify.txt" 2>nul
set "VERIFY="
if exist "%WORK%\verify.txt" for /f "usebackq delims=" %%a in ("%WORK%\verify.txt") do if not defined VERIFY set "VERIFY=%%a"

if "%VERIFY%"=="AKTIV" goto klart
goto inteaktiv

:visa_bara
echo  Det finns en nyare version: %LATESTV%
echo.
echo  Utan /kolla laddar samma fil ner och byter ut den at dig.
set "RESULT=nyare"
goto slut_ok

:klart
echo.
echo  Klart. %LATESTV% ar aktiv i Thunderbird.
echo  Dina regler och installningar ligger kvar.
set "RESULT=uppdaterad"
goto slut_ok

:inteaktiv
echo.
echo  Filen ar utbytt, men Thunderbird har inte tagit den an.
echo  Oppna Tillagg och teman, Ctrl+Skift+A, och valj Sok efter
echo  uppdateringar. Da hamtas samma version pa vanligt satt.
set "RESULT=osaker"
goto slut_ok

:tbkor
echo.
echo  Thunderbird kunde inte stangas. Det kan bero pa ett oppet
echo  fonster som vantar pa svar, till exempel ett utkast.
echo  Stang Thunderbird sjalv och kor filen igen.
set "RESULT=fel"
goto slut_fel

:downloadfel
echo.
echo  Nedladdningen misslyckades eller hade fel kontrollsumma.
echo  Ingenting har andrats i din installation.
echo  Filen finns har: %PAGE%
set "RESULT=fel"
goto slut_fel

:swapfel
echo.
echo  Kunde inte byta ut filen. Din gamla version ligger kvar
echo  orord - kopian lades i profilen under Lasfilter\Backup.
set "RESULT=fel"
goto slut_fel

:startfel
echo.
echo  Filen byttes, men Thunderbird kunde inte startas harifran.
echo  Starta Thunderbird sjalv - den nya versionen laddas da.
set "RESULT=uppdaterad"
goto slut_ok

:uppackad
echo.
echo  Din installation ar uppackad till en mapp, inte en XPI-fil.
echo  Oppna Tillagg och teman och valj Installera tillagg fran fil.
echo  Filen finns har: %NEW%
set "RESULT=fel"
goto slut_fel

:annanplats
echo.
echo  SortBro ligger inte i din profil utan pa en delad plats.
echo  Uppdatera via Tillagg och teman i stallet: Ctrl+Skift+A.
set "RESULT=fel"
goto slut_fel

:notinstalled
echo  Hittar ingen installerad SortBro i Thunderbird-profilen.
echo.
echo  Ar tillagget installerat i en annan profil, eller ar det har
echo  en annan dator, finns filen har: %PAGE%
set "RESULT=fel"
goto slut_fel

:noappdata
echo  APPDATA saknas. Skriptet maste kora i en vanlig Windows-session.
set "RESULT=fel"
goto slut_fel

:notemp
echo  Kunde inte skriva i TEMP-mappen.
set "RESULT=fel"
goto slut_fel

:nonetwork
echo  Kunde inte kontakta GitHub. Kontrollera anslutningen och kor igen.
set "RESULT=fel"
goto slut_fel

:slut_ok
if "%SILENT%"=="1" echo SortBro %RESULT%: %INSTALLED% till %LATESTV%
if "%SILENT%"=="0" echo.
if "%SILENT%"=="0" pause
endlocal & exit /b 0

:slut_fel
if "%SILENT%"=="1" echo SortBro fel: %RESULT%
if "%SILENT%"=="0" echo.
if "%SILENT%"=="0" pause
endlocal & exit /b 1

rem  ---------------------------------------------------------------
rem  Vad tycker Thunderbird sjalv om uppdateringar? Ar automatiken pa,
rem  och hur ofta letar den? Bara lasning - ingenting skrivs. Globala
rem  vaxeln ar extensions.update.enabled, takten extensions.update.interval
rem  (sekunder), och per tillagg galler applyBackgroundUpdates: 0 = av,
rem  1 = som standard, 2 = pa. Svaret blir en rad text till anvandaren.
:las_auto
set "AUTOTEXT=okant"
del "%WORK%\auto.txt" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{ $p='%PROFILE%'; $txt=''; $f=Join-Path $p 'prefs.js'; if(Test-Path $f){ $txt=[string](Get-Content -LiteralPath $f -Raw -ErrorAction SilentlyContinue) }; $en=$true; if($txt -match 'extensions\.update\.enabled\D{0,8}false'){ $en=$false }; $de=$true; if($txt -match 'extensions\.update\.autoUpdateDefault\D{0,8}false'){ $de=$false }; $iv=86400; $m=[regex]::Match($txt,'extensions\.update\.interval\D{0,8}(\d+)'); if($m.Success){ $iv=[int]$m.Groups[1].Value }; $ab=1; $j=Join-Path $p 'extensions.json'; if(Test-Path $j){ try{ $d=ConvertFrom-Json -InputObject (Get-Content -LiteralPath $j -Raw -ErrorAction Stop); $a=$d.addons | Where-Object {$_.id -eq '%ADDON_ID%'} | Select-Object -First 1; if($a -and $null -ne $a.applyBackgroundUpdates){ $ab=[int]$a.applyBackgroundUpdates } }catch{} }; $on=$false; if($en){ if($ab -eq 2){ $on=$true } elseif($ab -eq 0){ $on=$false } else { $on=$de } }; $u='t'; $n=[int][math]::Round($iv/3600); if($iv -lt 3600){ $u='m'; $n=[int][math]::Round($iv/60) }; if($n -lt 1){ $n=1 }; $s='off'; if($on){ $s='on' }; Write-Output ('AUTO|' + $s + '|' + $n + '|' + $u) }catch{ Write-Output 'AUTO|?|0|t' }" > "%WORK%\auto.txt" 2>nul
set "AUTOLINE="
if exist "%WORK%\auto.txt" for /f "usebackq delims=" %%a in ("%WORK%\auto.txt") do if not defined AUTOLINE set "AUTOLINE=%%a"
if not defined AUTOLINE exit /b 0
for /f "tokens=1,2,3,4 delims=|" %%a in ("%AUTOLINE%") do (
  set "AUTOSTATE=%%b"
  set "AUTONUM=%%c"
  set "AUTOUNIT=%%d"
)
if not "%AUTOSTATE%"=="on" goto las_auto_av
set "AUTOWHEN=med %AUTONUM% timmars mellanrum"
if "%AUTOUNIT%"=="m" set "AUTOWHEN=med %AUTONUM% minuters mellanrum"
if "%AUTONUM%"=="1" if "%AUTOUNIT%"=="t" set "AUTOWHEN=med 1 timmes mellanrum"
if "%AUTONUM%"=="1" if "%AUTOUNIT%"=="m" set "AUTOWHEN=med 1 minuts mellanrum"
set "AUTOTEXT=ja, Thunderbird letar sjalv %AUTOWHEN%"
exit /b 0
:las_auto_av
if "%AUTOSTATE%"=="off" set "AUTOTEXT=nej, automatiken ar avstangd i Thunderbird"
exit /b 0

rem  ---------------------------------------------------------------
rem  Las en profil: version, plats och sokvag till XPI-filen.
rem  Thunderbirds egen databas ar sanningen; filen ar reserv.
:las_profil
if defined INSTALLED exit /b 0
set "P=%~1"
if not exist "%P%\extensions.json" exit /b 0
del "%WORK%\p.txt" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%P%'; $id='%ADDON_ID%'; $v=''; $loc=''; $xpi=''; $j=Join-Path $p 'extensions.json'; if(Test-Path $j){ try{ $d=ConvertFrom-Json -InputObject (Get-Content $j -Raw -ErrorAction Stop); $a=$d.addons | Where-Object {$_.id -eq $id} | Select-Object -First 1; if($a){ $v=$a.version; $loc=$a.location } }catch{} }; $x=Join-Path $p ('extensions\' + $id + '.xpi'); if(Test-Path $x){ $xpi=$x }; if(-not $v -and $xpi){ try{ Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead($xpi); $e=$z.GetEntry('manifest.json'); $t=(New-Object System.IO.StreamReader($e.Open())).ReadToEnd(); $o=ConvertFrom-Json -InputObject $t; $v=$o.version; $z.Dispose() }catch{} }; $m=Join-Path $p ('extensions\' + $id + '\manifest.json'); if(-not $v -and (Test-Path $m)){ try{ $v=(ConvertFrom-Json -InputObject (Get-Content $m -Raw)).version }catch{} }; if($v){ Write-Output ($v + '|' + $loc + '|' + $xpi) }" > "%WORK%\p.txt" 2>nul
set "RES="
if exist "%WORK%\p.txt" for /f "usebackq delims=" %%a in ("%WORK%\p.txt") do if not defined RES set "RES=%%a"
if not defined RES exit /b 0
for /f "tokens=1,2,3 delims=|" %%a in ("%RES%") do (
  set "INSTALLED=%%a"
  set "LOC=%%b"
  set "XPIFILE=%%c"
)
set "PROFILE=%P%"
exit /b 0

rem  ---------------------------------------------------------------
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
