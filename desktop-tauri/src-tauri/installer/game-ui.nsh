; Atelier game-style pages. Installation/upgrade/uninstall remain owned by Tauri.
!include nsDialogs.nsh
!define MUI_BGCOLOR "14192D"
!define MUI_TEXTCOLOR "F6F0FA"
!define MUI_INSTFILESPAGE_COLORS "F6F0FA 14192D"
!define MUI_CUSTOMFUNCTION_GUIINIT GameGuiInit
Var GamePage
Var GameImage
Var GameBackdrop
Var GameLeftBitmap
Var GameArtWidth
Var GameFont
Var GameTitleFont
Var GameSmallFont
Var GameWidth
Var GameHeight
Var GameScale
Var GamePath
Var GameRun
Var GameShortcut
Var GameControl
Var GameProgress
Var GameProgressText
Var GameLog
Var GameButtonId
Var GameButtonFile
Var GameButtonHandle
Var GameButtonBitmap
Var GameButtonStyle
Var GameButtonWidth
Var GameButtonHeight
Var GameOldBitmap
Var GameHeadline
Var GameRequiredSize

!macro GameLabel x y w h text font color
  ${NSD_CreateLabel} ${x} ${y} ${w} ${h} "${text}"
  Pop $GameControl
  ${NSD_AddStyle} $GameControl ${WS_CLIPSIBLINGS}
  SetCtlColors $GameControl "${color}" "14192D"
  SendMessage $GameControl ${WM_SETFONT} ${font} 1
!macroend

Function GameGuiInit
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=atelier-background.bmp "${GAME_BACKGROUND}"
  File "${GAME_ASSET_DIR}\atelier-left.bmp"
  File "${GAME_ASSET_DIR}\button-*.bmp"
  CreateFont $GameFont "Microsoft YaHei UI" 11 400
  CreateFont $GameSmallFont "Microsoft YaHei UI" 9 400
  CreateFont $GameTitleFont "Microsoft YaHei UI" 26 600
  System::Call 'user32::GetDpiForWindow(p $HWNDPARENT) i.r0'
  IntCmp $0 0 0 +2 +2
  StrCpy $0 96
  StrCpy $GameScale $0
  IntOp $GameWidth 960 * $0
  IntOp $GameWidth $GameWidth / 96
  IntOp $GameHeight 672 * $0
  IntOp $GameHeight $GameHeight / 96
  System::Call 'user32::GetSystemMetrics(i 0) i.r1'
  System::Call 'user32::GetSystemMetrics(i 1) i.r2'
  IntOp $3 $1 - 32
  ${If} $GameWidth > $3
    StrCpy $GameWidth $3
  ${EndIf}
  IntOp $3 $2 - 48
  ${If} $GameHeight > $3
    StrCpy $GameHeight $3
  ${EndIf}
  IntOp $1 $1 - $GameWidth
  IntOp $1 $1 / 2
  IntOp $2 $2 - $GameHeight
  IntOp $2 $2 / 2
  System::Call 'user32::SetWindowPos(p $HWNDPARENT, p 0, i r1, i r2, i $GameWidth, i $GameHeight, i 0x14)'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)'
  SetCtlColors $HWNDPARENT "F6F0FA" "14192D"
  ; Native caption retains window dragging and keyboard/system-menu behavior.
  SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:绘遇 · 安装旅程"
  System::Call '*(i 0,i 0,i 0,i 0) p.r0'
  System::Call 'user32::GetClientRect(p $HWNDPARENT,p r0)'
  System::Call '*$0(i,i,i.r1,i.r2)'
  System::Free $0
  StrCpy $GameWidth $1
  IntOp $3 58 * $GameScale
  IntOp $3 $3 / 96
  IntOp $GameHeight $2 - $3
  System::Call 'user32::LoadImageW(p 0,w "$PLUGINSDIR\atelier-background.bmp",i 0,i $GameWidth,i $GameHeight,i 0x10) p.s'
  Pop $GameBackdrop
  IntOp $GameArtWidth $GameWidth * 52
  IntOp $GameArtWidth $GameArtWidth / 100
  System::Call 'user32::LoadImageW(p 0,w "$PLUGINSDIR\atelier-left.bmp",i 0,i $GameArtWidth,i $GameHeight,i 0x10) p.s'
  Pop $GameLeftBitmap
  System::Call 'user32::CreateWindowExW(i 0,w "STATIC",w "",i 0x5000000E,i 0,i 0,i $GameWidth,i $GameHeight,p $HWNDPARENT,p 0,p 0,p 0) p.r0'
  SendMessage $0 0x0172 0 $GameBackdrop
  System::Call 'user32::SetWindowPos(p r0,p 1,i 0,i 0,i 0,i 0,i 0x13)'
  ; Hide wizard header, separators and vendor branding.
  GetDlgItem $0 $HWNDPARENT 1037
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1038
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1034
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1035
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1028
  ShowWindow $0 ${SW_HIDE}
  Call GameFooter
FunctionEnd

Function GameFooter
  IntOp $1 $GameWidth * 55
  IntOp $1 $1 / 100
  IntOp $2 $GameHeight + 8
  IntOp $3 $GameWidth * 22
  IntOp $3 $3 / 100
  IntOp $4 36 * $GameScale
  IntOp $4 $4 / 96
  GetDlgItem $0 $HWNDPARENT 1
  System::Call 'user32::SetWindowPos(p r0,p 0,i r1,i r2,i r3,i r4,i 0x14)'
  SendMessage $0 ${WM_SETFONT} $GameFont 1
  System::Call 'uxtheme::SetWindowTheme(p r0,w "",w "")'
  SetCtlColors $0 "14192D" "E7BCD2"
  Push 1
  Push "continue"
  Call GameButton
  IntOp $1 $GameWidth * 79
  IntOp $1 $1 / 100
  IntOp $3 $GameWidth * 14
  IntOp $3 $3 / 100
  GetDlgItem $0 $HWNDPARENT 2
  System::Call 'user32::SetWindowPos(p r0,p 0,i r1,i r2,i r3,i r4,i 0x14)'
  SendMessage $0 ${WM_SETFONT} $GameSmallFont 1
  System::Call 'uxtheme::SetWindowTheme(p r0,w "",w "")'
  SetCtlColors $0 "F6F0FA" "252B43"
  Push 2
  Push "cancel"
  Call GameButton
  IntOp $1 $GameWidth * 4
  IntOp $1 $1 / 100
  GetDlgItem $0 $HWNDPARENT 3
  System::Call 'user32::SetWindowPos(p r0,p 0,i r1,i r2,i r3,i r4,i 0x14)'
  SendMessage $0 ${WM_SETFONT} $GameSmallFont 1
  Push 3
  Push "back"
  Call GameButton
FunctionEnd

Function GameButton
  Pop $GameButtonFile
  Pop $GameButtonId
  GetDlgItem $GameButtonHandle $HWNDPARENT $GameButtonId
  ${If} $GameButtonId == 1
    IntOp $GameButtonWidth $GameWidth * 22
  ${Else}
    IntOp $GameButtonWidth $GameWidth * 14
  ${EndIf}
  IntOp $GameButtonWidth $GameButtonWidth / 100
  IntOp $GameButtonHeight 36 * $GameScale
  IntOp $GameButtonHeight $GameButtonHeight / 96
  System::Call 'user32::LoadImageW(p 0,w "$PLUGINSDIR\button-$GameButtonFile.bmp",i 0,i $GameButtonWidth,i $GameButtonHeight,i 0x10) p.s'
  Pop $GameButtonBitmap
  System::Call 'user32::GetWindowLongW(p $GameButtonHandle,i -16) i.s'
  Pop $GameButtonStyle
  IntOp $GameButtonStyle $GameButtonStyle | 0x8080
  System::Call 'user32::SetWindowLongW(p $GameButtonHandle,i -16,i $GameButtonStyle)'
  SendMessage $GameButtonHandle 0x00F7 0 $GameButtonBitmap $GameOldBitmap
  ${If} $GameOldBitmap != 0
    System::Call 'gdi32::DeleteObject(p $GameOldBitmap)'
  ${EndIf}
FunctionEnd

Function GameShowPage
  ; Bitmap controls otherwise cover later siblings on classic Win32 dialogs.
  System::Call 'user32::SetWindowPos(p $GameImage,p 1,i 0,i 0,i 0,i 0,i 0x13)'
  nsDialogs::Show
FunctionEnd

Function GameCreatePage
  ${If} $GameHeadline != 0
    ShowWindow $GameHeadline ${SW_HIDE}
  ${EndIf}
  nsDialogs::Create 1044
  Pop $GamePage
  ${If} $GamePage == error
    Abort
  ${EndIf}
  System::Call 'user32::SetWindowPos(p $GamePage,p 0,i 0,i 0,i $GameWidth,i $GameHeight,i 0x14)'
  SetCtlColors $GamePage "F6F0FA" "14192D"
  ${NSD_CreateBitmap} 0 0 52% 100% ""
  Pop $GameImage
  ${NSD_AddStyle} $GameImage ${WS_CLIPSIBLINGS}
  SendMessage $GameImage 0x0172 0 $GameLeftBitmap
  !insertmacro GameLabel 56% 10% 38% 5% "HUIYU  /  ATELIER" $GameSmallFont "E7BCD2"
  !insertmacro GameLabel 56% 86% 38% 5% "绘遇  ·  ${VERSION}  /  Windows x64" $GameSmallFont "BFC2D3"
  Call GameFooter
FunctionEnd

Function GameWelcome
  Call SkipIfPassive
  Call GameCreatePage
  !insertmacro GameLabel 56% 22% 40% 21% "让灵感，$\r$\n在此相遇。" $GameTitleFont "F6F0FA"
  !insertmacro GameLabel 56% 49% 37% 16% "属于你的角色、故事与创作。$\r$\n将绘遇安放在电脑里，开启新的旅程。" $GameFont "CED0DF"
  !insertmacro GameLabel 56% 71% 38% 8% "角色陪伴  /  图像创作  /  剧情短片" $GameSmallFont "E7BCD2"
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:开始旅程  →"
  Push 1
  Push "welcome"
  Call GameButton
  Call GameShowPage
FunctionEnd

Function GameDirectory
  Call SkipIfPassive
  Call GameCreatePage
  !insertmacro GameLabel 56% 22% 40% 13% "安放你的绘遇" $GameTitleFont "F6F0FA"
  !insertmacro GameLabel 56% 38% 38% 10% "选择安装位置。角色与创作空间将在这里准备就绪。" $GameFont "CED0DF"
  !insertmacro GameLabel 56% 53% 38% 5% "安装位置" $GameSmallFont "E7BCD2"
  ${NSD_CreateDirRequest} 56% 60% 28% 5% "$INSTDIR"
  Pop $GamePath
  SendMessage $GamePath ${WM_SETFONT} $GameSmallFont 1
  SetCtlColors $GamePath "F6F0FA" "252B43"
  ${NSD_CreateBrowseButton} 85% 60% 9% 5% "更改"
  Pop $GameControl
  SendMessage $GameControl ${WM_SETFONT} $GameSmallFont 1
  ${NSD_OnClick} $GameControl GameBrowse
  IntOp $GameRequiredSize ${ESTIMATEDSIZE} / 1024
  IntOp $GameRequiredSize $GameRequiredSize + 1
  !insertmacro GameLabel 56% 69% 38% 5% "所需空间约 $GameRequiredSize MB" $GameSmallFont "E7BCD2"
  !insertmacro GameLabel 56% 76% 38% 9% "安装会保留个人设置与创作记录。$\r$\n生成模型不包含在此安装包中。" $GameSmallFont "BFC2D3"
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:安装绘遇  →"
  Push 1
  Push "install"
  Call GameButton
  Call GameShowPage
FunctionEnd

Function GameBrowse
  nsDialogs::SelectFolderDialog "选择绘遇的安装位置" "$INSTDIR"
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $GamePath "$0\${PRODUCTNAME}"
  ${EndIf}
FunctionEnd

Function GameDirectoryLeave
  ${NSD_GetText} $GamePath $INSTDIR
  System::Call 'shlwapi::PathIsRelativeW(w "$INSTDIR") i.r2'
  ${If} $2 != 0
    MessageBox MB_ICONEXCLAMATION "请输入完整的安装路径。"
    Abort
  ${EndIf}
  GetFullPathName $INSTDIR "$INSTDIR"
  trim_path:
    StrCpy $1 $INSTDIR 1 -1
    ${If} $1 == "\"
      StrCpy $INSTDIR $INSTDIR -1
      Goto trim_path
    ${EndIf}
  ${GetRoot} "$INSTDIR" $0
  ${GetParent} "$INSTDIR" $1
  ${If} $INSTDIR == ""
  ${OrIf} $0 == ""
  ${OrIf} $1 == ""
  ${OrIf} $INSTDIR == $0
  ${OrIf} $INSTDIR == "$0\"
  ${OrIf} $INSTDIR == $WINDIR
  ${OrIf} $INSTDIR == $SYSDIR
  ${OrIf} $INSTDIR == $PROGRAMFILES
  ${OrIf} $INSTDIR == $PROGRAMFILES64
  ${OrIf} $INSTDIR == $PROFILE
    MessageBox MB_ICONEXCLAMATION "请选择专门的应用文件夹，例如 D:\Games\AI-CG-Studio。"
    Abort
  ${EndIf}
FunctionEnd

Function GameInstallShow
  FindWindow $GamePage "#32770" "" $HWNDPARENT
  GetDlgItem $GameProgressText $GamePage 1006
  GetDlgItem $GameProgress $GamePage 1004
  GetDlgItem $GameLog $GamePage 1016
  ; Keep Tauri's real progress and diagnostic log; move them into the art panel.
  IntOp $0 $GameWidth * 56
  IntOp $0 $0 / 100
  IntOp $1 $GameHeight * 24
  IntOp $1 $1 / 100
  IntOp $2 $GameWidth * 38
  IntOp $2 $2 / 100
  IntOp $3 $GameHeight * 58
  IntOp $3 $3 / 100
  IntOp $4 $GameHeight * 10
  IntOp $4 $4 / 100
  System::Call 'user32::CreateWindowExW(i 0,w "STATIC",w "正在唤醒绘遇",i 0x50000000,i r0,i r4,i r2,i 90,p $HWNDPARENT,p 0,p 0,p 0) p.s'
  Pop $GameHeadline
  SendMessage $GameHeadline ${WM_SETFONT} $GameTitleFont 1
  SetCtlColors $GameHeadline "F6F0FA" "14192D"
  System::Call 'user32::SetWindowPos(p $GamePage,p 0,i r0,i r1,i r2,i r3,i 0x14)'
  SetCtlColors $GamePage "F6F0FA" "14192D"
  System::Call 'user32::SetWindowPos(p $GameProgressText,p 0,i 0,i 0,i r2,i 36,i 0x14)'
  System::Call 'user32::SetWindowPos(p $GameProgress,p 0,i 0,i 48,i r2,i 14,i 0x14)'
  IntOp $3 $3 - 92
  System::Call 'user32::SetWindowPos(p $GameLog,p 0,i 0,i 82,i r2,i r3,i 0x14)'
  SetCtlColors $GameProgressText "F6F0FA" "14192D"
  SetCtlColors $GameLog "CED0DF" "14192D"
  System::Call 'uxtheme::SetWindowTheme(p $GameProgress,w "",w "")'
  SendMessage $GameProgress 0x0409 0 0xD2BCE7
  SendMessage $GameProgress 0x2001 0 0x432B25
  GetDlgItem $GameControl $GamePage 1027
  System::Call 'user32::SetWindowPos(p $GameControl,p 0,i 0,i 82,i 180,i 36,i 0x14)'
  SendMessage $GameControl ${WM_SETTEXT} 0 "STR:查看安装明细"
  SendMessage $GameControl ${WM_SETFONT} $GameSmallFont 1
  ShowWindow $GameControl ${SW_SHOW}
  ShowWindow $GameLog ${SW_HIDE}
  Call GameFooter
FunctionEnd

Function GameFinish
  Call SkipIfPassive
  Call GameCreatePage
  !insertmacro GameLabel 56% 22% 40% 21% "绘遇已就绪。$\r$\n故事，由你开启。" $GameTitleFont "F6F0FA"
  !insertmacro GameLabel 56% 49% 38% 10% "欢迎回来，创作者。$\r$\n从一个角色、一束光，或一个念头开始。" $GameFont "CED0DF"
  ${NSD_CreateCheckbox} 56% 65% 38% 6% "创建桌面快捷方式"
  Pop $GameShortcut
  SendMessage $GameShortcut ${WM_SETFONT} $GameSmallFont 1
  System::Call 'uxtheme::SetWindowTheme(p $GameShortcut,w "",w "")'
  SetCtlColors $GameShortcut "CED0DF" "14192D"
  ${NSD_Check} $GameShortcut
  ${NSD_CreateCheckbox} 56% 73% 38% 6% "完成后打开绘遇"
  Pop $GameRun
  SendMessage $GameRun ${WM_SETFONT} $GameSmallFont 1
  System::Call 'uxtheme::SetWindowTheme(p $GameRun,w "",w "")'
  SetCtlColors $GameRun "CED0DF" "14192D"
  ${NSD_Check} $GameRun
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:进入绘遇  →"
  Push 1
  Push "finish"
  Call GameButton
  Call GameShowPage
FunctionEnd

Function GameFinishLeave
  ${NSD_GetState} $GameShortcut $0
  ${If} $0 = ${BST_CHECKED}
    Call CreateOrUpdateDesktopShortcut
  ${EndIf}
  ${NSD_GetState} $GameRun $0
  ${If} $0 = ${BST_CHECKED}
    Call RunMainBinary
  ${EndIf}
FunctionEnd
