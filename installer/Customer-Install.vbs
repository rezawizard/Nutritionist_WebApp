Option Explicit

Dim shell, fso, folder, file, installer, command, appData, source, backupRoot, backupFolder
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

appData = shell.ExpandEnvironmentStrings("%APPDATA%")
source = fso.BuildPath(appData, "com.rezo.persian-dietitian")
backupRoot = fso.BuildPath(shell.SpecialFolders("MyDocuments"), "Dietoy Update Backups")
backupFolder = fso.BuildPath(backupRoot, "pre-install-backup")

On Error Resume Next
If fso.FolderExists(source) Then
  If Not fso.FolderExists(backupRoot) Then fso.CreateFolder backupRoot
  If fso.FolderExists(backupFolder) Then fso.DeleteFolder backupFolder, True
  fso.CopyFolder source, backupFolder, True
End If
On Error GoTo 0

command = """" & installer & """"
shell.Run command, 1, True
MsgBox "Installation finished. Existing Dietoy data is kept. A safety backup is stored in Documents\\Dietoy Update Backups when previous data exists.", vbInformation, "Dietoy"
