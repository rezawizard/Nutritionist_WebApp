!macro NSIS_HOOK_POSTINSTALL
  SetShellVarContext current
  IfFileExists "$INSTDIR\persian_dietitian_desktop.exe" 0 +2
    CreateShortcut "$DESKTOP\Dietory.lnk" "$INSTDIR\persian_dietitian_desktop.exe"
  IfFileExists "$INSTDIR\Dietory.exe" 0 +2
    CreateShortcut "$DESKTOP\Dietory.lnk" "$INSTDIR\Dietory.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  SetShellVarContext current
  Delete "$DESKTOP\Dietory.lnk"
!macroend
