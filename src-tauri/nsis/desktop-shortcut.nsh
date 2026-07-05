!macro NSIS_HOOK_POSTINSTALL
  CreateShortcut "$DESKTOP\\Matab Taghzieh.lnk" "$INSTDIR\\${MAINBINARYNAME}.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$DESKTOP\\Matab Taghzieh.lnk"
!macroend
