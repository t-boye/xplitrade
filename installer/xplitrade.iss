; Xplitrade Windows Installer
; Built with Inno Setup 6.x — https://jrsoftware.org/isinfo.php
;
; To build: open this file in Inno Setup Compiler and click Build → Compile
; Output: installer/Output/XplitradeSetup.exe

#define AppName    "Xplitrade"
#define AppVersion "1.0.0"
#define AppPublisher "Xplitrade"
#define AppURL "https://xplitrade.io"
#define AppExeName "Xplitrade.lnk"

[Setup]
AppId={{8F3A1B2C-4D5E-6F7A-8B9C-0D1E2F3A4B5C}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE
OutputDir=Output
OutputBaseFilename=XplitradeSetup
SetupIconFile=assets\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=110
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
MinVersion=10.0.17763

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startmenuicon"; Description: "Create Start Menu shortcut"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; Main launcher
Source: "launcher.bat"; DestDir: "{app}"; Flags: ignoreversion

; Default config scaffold
Source: "config\config.json"; DestDir: "{app}\config"; Flags: ignoreversion onlyifdoesntexist

; Logo / assets
Source: "assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs

; TA-Lib wheel for offline install (place the .whl in installer\talib\ before building)
; Source: "talib\TA_Lib-*.whl"; DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall

[Icons]
Name: "{group}\{#AppName}";        Filename: "{app}\launcher.bat"; WorkingDir: "{app}"; Comment: "Launch Xplitrade trading bot"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\launcher.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Check Python 3.11+ is available
Filename: "{cmd}"; Parameters: "/c python --version > ""{tmp}\pyver.txt"" 2>&1"; Flags: runhidden; StatusMsg: "Checking Python..."

; Install xplitrade via pip (needs internet on first run)
Filename: "{cmd}"; Parameters: "/c python -m pip install --quiet xplitrade"; \
  Flags: runhidden; StatusMsg: "Installing Xplitrade (this may take a minute)..."; \
  BeforeInstall: CheckPython

; Offer to launch after install
Filename: "{app}\launcher.bat"; Description: "Launch Xplitrade now"; Flags: nowait postinstall skipifsilent shellexec

[Code]
procedure CheckPython();
var
  ResultCode: Integer;
begin
  if not Exec('cmd.exe', '/c python --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
  begin
    if MsgBox('Python 3.11 or later is required but was not found.'#13#10 +
              'Please install Python from https://python.org first.'#13#10#13#10 +
              'Open python.org now?', mbError, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://www.python.org/downloads/', '', '', SW_SHOW, ewNoWait, ResultCode);
    end;
    Abort();
  end;
end;

procedure InitializeWizard();
begin
  WizardForm.WelcomeLabel2.Caption :=
    'This will install Xplitrade on your computer.'#13#10#13#10 +
    'Xplitrade is a self-hosted algorithmic crypto trading bot.'#13#10 +
    'Start in dry-run mode — no real money at risk.'#13#10#13#10 +
    'Requirements: Python 3.11+ (already installed separately)';
end;
