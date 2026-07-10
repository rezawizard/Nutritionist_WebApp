Option Explicit

Dim shell, fso, folder, script, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
script = fso.BuildPath(folder, "Build-USB-Package.ps1")

If Not fso.FileExists(script) Then
  MsgBox "Build script was not found.", vbCritical, "Dietory"
  WScript.Quit 1
End If

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & """" & script & """"
Dim exitCode
exitCode = shell.Run(command, 0, True)

If exitCode = 0 Then
  MsgBox "USB package build finished. Open the release-usb folder.", vbInformation, "Dietory"
Else
  MsgBox "Build did not finish. Install Microsoft C++ Build Tools first, then run this file again.", vbCritical, "Dietory"
End If
