Option Explicit

Dim shell, fso, folder, file, installer, command, result
Dim appData, source, backupRoot, latestBackup, previousBackup, stagingBackup
Dim closeCommand, closeResult, backupError
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
installer = fso.BuildPath(folder, "Dietory-5.3.0-Setup.exe")

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
  MsgBox "فایل نصب پیدا نشد. فایل UPDATE-CURRENT-APP.vbs را کنار Dietory-5.3.0-Setup.exe نگه دارید.", vbCritical, "Dietory"
  WScript.Quit 1
End If

' Close Dietory through its normal window-close path so the in-app complete backup runs.
closeCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command """ & _
  "$names=@('persian_dietitian_desktop','Dietory');" & _
  "$ps=Get-Process -ErrorAction SilentlyContinue | Where-Object { $names -contains $_.ProcessName };" & _
  "if($ps){$ps | ForEach-Object {[void]$_.CloseMainWindow()};" & _
  "$limit=(Get-Date).AddMinutes(3);" & _
  "while((Get-Process -ErrorAction SilentlyContinue | Where-Object { $names -contains $_.ProcessName }) -and (Get-Date) -lt $limit){Start-Sleep -Milliseconds 500};" & _
  "if(Get-Process -ErrorAction SilentlyContinue | Where-Object { $names -contains $_.ProcessName }){exit 9}};exit 0"""
closeResult = shell.Run(closeCommand, 0, True)
If closeResult <> 0 Then
  MsgBox "Dietory هنوز باز است یا پشتیبان‌گیری هنگام خروج کامل نشده است. برنامه را به‌صورت عادی ببندید و دوباره گزینه بروزرسانی را اجرا کنید.", vbExclamation, "Dietory Update"
  WScript.Quit 2
End If

' Create a second raw safety copy after the app is fully closed.
appData = shell.ExpandEnvironmentStrings("%APPDATA%")
source = fso.BuildPath(appData, "com.rezo.persian-dietitian")
backupRoot = fso.BuildPath(shell.SpecialFolders("MyDocuments"), "Dietory Update Backups")
latestBackup = fso.BuildPath(backupRoot, "pre-update-latest")
previousBackup = fso.BuildPath(backupRoot, "pre-update-previous")
stagingBackup = fso.BuildPath(backupRoot, ".pre-update-next")

If fso.FolderExists(source) Then
  On Error Resume Next
  If Not fso.FolderExists(backupRoot) Then fso.CreateFolder backupRoot
  If fso.FolderExists(stagingBackup) Then fso.DeleteFolder stagingBackup, True
  fso.CopyFolder source, stagingBackup, True
  backupError = Err.Number
  If backupError = 0 Then
    If fso.FolderExists(previousBackup) Then fso.DeleteFolder previousBackup, True
    If fso.FolderExists(latestBackup) Then fso.MoveFolder latestBackup, previousBackup
    If Err.Number = 0 Then fso.MoveFolder stagingBackup, latestBackup
    backupError = Err.Number
  End If
  On Error GoTo 0
  If backupError <> 0 Then
    MsgBox "پشتیبان ایمنی قبل از بروزرسانی ساخته نشد؛ برای جلوگیری از خطر، بروزرسانی متوقف شد. فضای دیسک و دسترسی پوشه Documents را بررسی کنید.", vbCritical, "Dietory Update"
    WScript.Quit 3
  End If
End If

command = """" & installer & """ /UPDATE"
result = shell.Run(command, 1, True)
If result = 0 Then
  MsgBox "Dietory با موفقیت به نسخه 5.3.0 بروزرسانی شد. پرونده‌ها، تنظیمات و فایل‌های قبلی حفظ شده‌اند.", vbInformation, "Dietory Update"
Else
  MsgBox "بروزرسانی کامل نشد. کد خطا: " & result & vbCrLf & "پشتیبان پیش از بروزرسانی در Documents\Dietory Update Backups نگهداری شده است.", vbCritical, "Dietory Update"
  WScript.Quit result
End If
