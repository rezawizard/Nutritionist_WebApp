Option Explicit

Dim shell, fso, folder, file, installer, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
installer = ""

For Each file In fso.GetFolder(folder).Files
  If LCase(fso.GetExtensionName(file.Name)) = "exe" Then
    If InStr(LCase(file.Name), "setup") > 0 Or InStr(LCase(file.Name), "installer") > 0 Then
      installer = file.Path
      Exit For
    End If
  End If
Next

If installer = "" Then
  MsgBox "Installer EXE was not found in this folder. Put Dietory-5.2.0-Setup.exe beside this VBS file.", vbCritical, "Dietory"
  WScript.Quit 1
End If

command = """" & installer & """ /S"
shell.Run command, 0, True
MsgBox "Installation finished. The desktop shortcut should now be available.", vbInformation, "Dietory"
