; ═══════════════════════════════════════════════════════
;  IAN'S MUSIC — Premium NSIS Installer Configuration
;  ═══════════════════════════════════════════════════════

!define MUI_WELCOMEPAGE_TITLE "Welcome to IAN'S MUSIC"
!define MUI_WELCOMEPAGE_TEXT "A premium desktop music player. Multi-platform search, AI-powered lyrics translation, meticulously crafted visual experience.$\r$\n$\r$\nSetup will guide you through the installation."

!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "IAN'S MUSIC is ready.$\r$\n$\r$\nDiscover, play, and immerse yourself in music."
!define MUI_FINISHPAGE_RUN_TEXT "Launch IAN'S MUSIC"

!define MUI_UNTEXT_WELCOME_INFO_TITLE "Uninstall IAN'S MUSIC"
!define MUI_UNTEXT_CONFIRM_TITLE "Confirm Removal"
!define MUI_UNTEXT_FINISH_TITLE "Removal Complete"
!define MUI_UNTEXT_FINISH_TEXT "IAN'S MUSIC has been removed from your computer."

!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING
!define MUI_TEXT_ABORTWARNING "Are you sure you want to cancel the IAN'S MUSIC installation?"
!define MUI_UNTEXT_ABORTWARNING "Are you sure you want to cancel the uninstallation?"

; ═══════════════════════════════════════════════════════
;  Upgrade Mode: Overwrite existing installation
;  ═══════════════════════════════════════════════════════
!macro customInit
  ; If already installed, reuse the same directory and overwrite
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "InstallLocation"
  ${If} $R0 != ""
    ${If} ${FileExists} "$R0\IansMusic.exe"
      StrCpy $INSTDIR $R0
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  ; Backup songs folder before cleaning old app files (preserve user downloads)
  ${If} ${FileExists} "$INSTDIR\songs"
    CreateDirectory "$TEMP\IansMusic_songs_backup"
    CopyFiles /SILENT "$INSTDIR\songs\*.*" "$TEMP\IansMusic_songs_backup"
  ${EndIf}

  ; Remove old app files before installing new ones (clean upgrade)
  RMDir /r "$INSTDIR\resources\app"

  ; Restore songs folder after upgrade
  ${If} ${FileExists} "$TEMP\IansMusic_songs_backup"
    CreateDirectory "$INSTDIR\songs"
    CopyFiles /SILENT "$TEMP\IansMusic_songs_backup\*.*" "$INSTDIR\songs"
    RMDir /r "$TEMP\IansMusic_songs_backup"
  ${EndIf}
!macroend

; ═══════════════════════════════════════════════════════
;  Uninstall: Preserve user downloaded music
;  ═══════════════════════════════════════════════════════
!macro customUnInstall
  ; Move songs folder to temp before uninstaller deletes everything
  ; so user's downloaded music survives uninstall
  ${If} ${FileExists} "$INSTDIR\songs"
    CreateDirectory "$TEMP\IansMusic_songs_backup"
    CopyFiles /SILENT "$INSTDIR\songs\*.*" "$TEMP\IansMusic_songs_backup"
  ${EndIf}
!macroend

!macro customUnInstall.End
  ; Restore songs folder after uninstall cleanup
  ${If} ${FileExists} "$TEMP\IansMusic_songs_backup"
    CreateDirectory "$INSTDIR\songs"
    CopyFiles /SILENT "$TEMP\IansMusic_songs_backup\*.*" "$INSTDIR\songs"
    RMDir /r "$TEMP\IansMusic_songs_backup"
  ${EndIf}
!macroend
