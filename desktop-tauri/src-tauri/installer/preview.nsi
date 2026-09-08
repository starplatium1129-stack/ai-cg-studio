Unicode true
ManifestDPIAware true
RequestExecutionLevel user
!include MUI2.nsh
!include FileFunc.nsh
!define PRODUCTNAME "AI-CG-Studio"
!define VERSION "PREVIEW"
!define ESTIMATEDSIZE "520000"
!include "${GAME_UI}"
Name "绫季绘境 · 安装界面预览（不安装）"
Caption "绫季绘境 · 安装界面预览"
Icon "..\icons\icon.ico"
OutFile "generated\atelier-preview-${GAME_PREVIEW_PAGE}.exe"
InstallDir "$LOCALAPPDATA\AI-CG-Studio-Preview"
!if "${GAME_PREVIEW_PAGE}" == "welcome"
Page custom GameWelcome
Page custom GameDirectory GameDirectoryLeave
!else if "${GAME_PREVIEW_PAGE}" == "directory"
Page custom GameDirectory GameDirectoryLeave
!else if "${GAME_PREVIEW_PAGE}" == "finish"
Page custom GameFinish GameFinishLeave
!else if "${GAME_PREVIEW_PAGE}" == "maintenance"
Page custom GameMaintenancePreview
!endif
!define MUI_PAGE_CUSTOMFUNCTION_SHOW GameInstallShow
!insertmacro MUI_PAGE_INSTFILES
Page custom GameFinish GameFinishLeave
!insertmacro MUI_LANGUAGE "SimpChinese"
Function SkipIfPassive
FunctionEnd
Function RunMainBinary
  ; Preview intentionally never starts or installs the application.
FunctionEnd
Function CreateOrUpdateDesktopShortcut
  ; Preview intentionally never writes a shortcut.
FunctionEnd
Function GameMaintenancePreview
  Call GameCreatePage
  !insertmacro GameLabel 56% 22% 40% 13% "继续你的旅程" $GameTitleFont "F6F0FA"
  !insertmacro GameLabel 56% 40% 38% 18% "检测到已安装的绘境，请选择如何更新。" $GameFont "CED0DF"
  ${NSD_CreateRadioButton} 56% 62% 38% 8% "卸载旧版本后安装"
  Pop $R2
  System::Call 'uxtheme::SetWindowTheme(p $R2,w "",w "")'
  SendMessage $R2 ${WM_SETFONT} $GameSmallFont 1
  SetCtlColors $R2 "F6F0FA" "14192D"
  ${NSD_CreateRadioButton} 56% 73% 38% 8% "保留并更新现有安装"
  Pop $R3
  System::Call 'uxtheme::SetWindowTheme(p $R3,w "",w "")'
  SendMessage $R3 ${WM_SETFONT} $GameSmallFont 1
  SetCtlColors $R3 "F6F0FA" "14192D"
  ${NSD_Check} $R2
  Call GameShowPage
FunctionEnd
Section
  DetailPrint "预览模式：不会安装或修改现有软件。"
  Sleep 4000
SectionEnd
