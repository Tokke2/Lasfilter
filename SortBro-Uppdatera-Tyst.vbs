' SortBro - startar uppdateringen utan terminalfonster.
' Lag filen bredvid Uppdatera-SortBro.bat och dubbelklicka pa den har.
Option Explicit
Dim fso, sh, folder, script
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
script = fso.BuildPath(folder, "Uppdatera-SortBro.bat")
If Not fso.FileExists(script) Then
  MsgBox "Uppdatera-SortBro.bat saknas bredvid den har filen.", 16, "SortBro"
  WScript.Quit 1
End If
sh.Run """" & script & """ /tyst /hidden", 0, False
