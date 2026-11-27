@echo off
setlocal EnableExtensions
title SortBro - daglig uppdatering 00:00
rem  Engangssteg: skapar en schemalagd uppgift som varje natt klockan 00:00
rem  kor den tysta uppdateraren. Inget terminalfonster visas vid korningen.
set "VBS=%~dp0SortBro-Uppdatera-Tyst.vbs"
if not exist "%VBS%" (
  echo SortBro-Uppdatera-Tyst.vbs saknas bredvid den har filen.
  pause
  exit /b 1
)
schtasks /Create /TN "SortBro daglig uppdatering" /SC DAILY /ST 00:00 /TR "wscript.exe \"%VBS%\"" /F
if errorlevel 1 (
  echo.
  echo Kunde inte skapa uppgiften. Kor filen som vanlig anvandare igen,
  echo eller skapa uppgiften manuellt i Aktivitetshanteraren.
  pause
  exit /b 1
)
echo.
echo Klart. SortBro kontrollerar och uppdaterar varje natt klockan 00:00.
echo Uppgiften heter "SortBro daglig uppdatering" i Aktivitetshanteraren.
pause
