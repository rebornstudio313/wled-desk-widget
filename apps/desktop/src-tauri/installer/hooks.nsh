!macro NSIS_HOOK_POSTINSTALL
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "WLED Desk Widget"
  StrCmp $0 "" startup_done
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "WLED Desk Widget" '$"$INSTDIR\wled-desk-widget.exe$" --autostart'
  startup_done:
!macroend
!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "WLED Desk Widget"
!macroend
