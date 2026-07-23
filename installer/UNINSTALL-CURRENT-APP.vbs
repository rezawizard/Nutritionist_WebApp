Option Explicit
Dim shell, fso, candidates, path, found
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
candidates = Array( _
  shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Dietory\uninstall.exe"), _
  shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Dietory\uninstall.exe") _
)
found = ""
For Each path In candidates
  If fso.FileExists(path) Then found = path: Exit For
Next
If found = "" Then
  MsgBox "حذف‌کننده Dietory به‌صورت خودکار پیدا نشد. صفحه Apps & features ویندوز باز می‌شود؛ Dietory را از آنجا انتخاب کنید.", vbInformation, "Dietory"
  shell.Run "ms-settings:appsfeatures", 1, False
  WScript.Quit 0
End If
If MsgBox("آیا Dietory حذف شود؟ برای حفظ اطلاعات، گزینه حذف داده‌های برنامه را در حذف‌کننده فعال نکنید.", vbYesNo + vbQuestion, "حذف Dietory") = vbYes Then
  shell.Run """" & found & """", 1, True
End If
