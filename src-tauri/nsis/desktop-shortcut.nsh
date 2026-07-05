!macro NSIS_HOOK_POSTINSTALL
  SetShellVarContext current
  IfFileExists "$INSTDIR\persian_dietitian_desktop.exe" 0 +2
    CreateShortcut "$DESKTOP\Dietoy.lnk" "$INSTDIR\persian_dietitian_desktop.exe"
  IfFileExists "$INSTDIR\Dietoy.exe" 0 +2
    CreateShortcut "$DESKTOP\Dietoy.lnk" "$INSTDIR\Dietoy.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  SetShellVarContext current
  Delete "$DESKTOP\Dietoy.lnk"
!macroend
