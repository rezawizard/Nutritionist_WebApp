Option Explicit

Dim shell, fso, folder, file, installer, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
installer = fso.BuildPath(folder, "Dietoy-Setup.exe")

If Not fso.FileExists(installer) Then
  installer = ""
  For Each file In fso.GetFolder(folder).Files
    If LCase(fso.GetExtensionName(file.Name)) = "exe" Then
      If InStr(LCase(file.Name), "setup") > 0 Or InStr(LCase(file.Name), "installer") > 0 Then
        installer = file.Path
        Exit For
      End If
    End If
  Next
End If

If installer = "" Then
  MsgBox "Setup file was not found. Keep INSTALL.vbs beside Dietoy-Setup.exe.", vbCritical, "Dietoy"
  WScript.Quit 1
End If

command = """" & installer & """"
shell.Run command, 1, True
MsgBox "Installation finished. You can open Dietoy from the desktop icon.", vbInformation, "Dietoy"
