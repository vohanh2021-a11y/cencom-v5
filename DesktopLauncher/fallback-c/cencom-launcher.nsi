; ============================================================================
;  CencomOS Garage Launcher - NSIS installer
;  Build bang makensis (NSIS 3.x). Nguon exe lay tu thu muc fallback-c\bin
;  (chay build.ps1 truoc de co cac file nay).
;
;  makensis cencom-launcher.nsi
; ============================================================================

Unicode true

!define PRODUCT_NAME    "CencomOS Garage Launcher"
!define PRODUCT_VERSION "4.0.0"
!define PRODUCT_PUBLISHER "Cencom"
!define SETUP_NAME      "cencom-launcher-setup.exe"
!define INST_DIR        "$PROGRAMFILES64\CencomOS Garage"

Name "${PRODUCT_NAME}"
Caption "${PRODUCT_NAME} Setup"
OutFile "${SETUP_NAME}"
InstallDir "${INST_DIR}"
InstallDirRegKey HKLM "Software\CencomOS Garage Launcher" "InstallDir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!include "MUI2.nsh"

!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Vietnamese"
!insertmacro MUI_LANGUAGE "English"

; ---------------- Sections ----------------

; Launcher chinh dung WebView2 (bat buoc cai: chay duoc khi may co WebView2 Runtime)
Section "Launcher chinh (WebView2)" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "bin\cencom-launcher.exe"
  File "bin\WebView2Loader.dll"

  ; Canh bao nhe neu chua cai WebView2 Runtime (khong chan cai dat)
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" 0 lbl_runtime_ok
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  lbl_runtime_ok:
  StrCmp $0 "" 0 lbl_runtime_ok2
    MessageBox MB_OK|MB_ICONINFORMATION "Khong phat hien WebView2 Runtime. Neu launcher khong chay, cai tu: https://developer.microsoft.com/microsoft-edge/webview2/"
  lbl_runtime_ok2:
SectionEnd

; Launcher don gian dung Edge app mode (khong can WebView2)
Section "Launcher don gian (Edge app mode)" SecSimple
  SetOutPath "$INSTDIR"
  File "bin\cencom-launcher-simple.exe"
SectionEnd

; Shortcut Desktop tro den launcher da chon (uu tien launcher chinh)
Section "Tao shortcut Desktop" SecShortcut
  SectionGetFlags ${SecMain} $0
  IntOp $0 $0 & ${SF_SELECTED}
  IntCmp $0 ${SF_SELECTED} 0 lbl_use_simple lbl_use_simple
    CreateShortCut "$DESKTOP\CencomOS Garage.lnk" "$INSTDIR\cencom-launcher.exe"
    Goto lbl_shortcut_done
  lbl_use_simple:
    CreateShortCut "$DESKTOP\CencomOS Garage.lnk" "$INSTDIR\cencom-launcher-simple.exe"
  lbl_shortcut_done:
SectionEnd

; Phan cai dat chung (khong the bo chon - ten bat dau bang "-")
Section "-Cai dat chung" SecCommon
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayIcon" "$INSTDIR\cencom-launcher.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\CencomOS Garage Launcher" "InstallDir" "$INSTDIR"
SectionEnd

; ---------------- Uninstall ----------------
Section "Uninstall"
  Delete "$INSTDIR\cencom-launcher.exe"
  Delete "$INSTDIR\cencom-launcher-simple.exe"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$DESKTOP\CencomOS Garage.lnk"
  Delete "$SMPROGRAMS\CencomOS Garage\*.*"
  RMDir "$SMPROGRAMS\CencomOS Garage"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
  DeleteRegKey HKLM "Software\CencomOS Garage Launcher"
SectionEnd