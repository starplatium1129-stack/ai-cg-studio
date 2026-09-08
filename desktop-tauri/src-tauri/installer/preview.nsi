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
Section
  DetailPrint "预览模式：不会安装或修改现有软件。"
  Sleep 4000
SectionEnd
