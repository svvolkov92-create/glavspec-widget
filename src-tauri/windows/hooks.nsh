; 4.23: Windows keeps the big desktop icons in its own icon cache, so after an update a shortcut could show the
; old icon at large sizes (zooming the desktop) while the taskbar already shows the new one. Refresh that cache.
!macro NSIS_HOOK_POSTINSTALL
  ; SHCNE_ASSOCCHANGED with SHCNF_FLUSH: Explorer reloads the icons it shows.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
  ; Windows 10/11: rebuild the user's icon cache.
  IfFileExists "$SYSDIR\ie4uinit.exe" 0 +2
    ExecWait '"$SYSDIR\ie4uinit.exe" -show'
!macroend
