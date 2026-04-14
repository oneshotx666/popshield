#define MyAppName "PopShield"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "oneshotx666"
#define MyAppURL "https://github.com/oneshotx666/popshield"
#define MyAppExeName "PopShield-Setup-" + MyAppVersion

[Setup]
AppId={{E0FB75EE-3103-46C9-B8CB-B5901771B5E0}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\PopShield
DefaultGroupName=PopShield
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=dist
OutputBaseFilename={#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\..\manifest.json"; DestDir: "{app}\Extension"; Flags: ignoreversion
Source: "..\..\background\*"; DestDir: "{app}\Extension\background"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\content\*"; DestDir: "{app}\Extension\content"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\icons\*"; DestDir: "{app}\Extension\icons"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\popup\*"; DestDir: "{app}\Extension\popup"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\rules\*"; DestDir: "{app}\Extension\rules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "support\LaunchInstallHelper.ps1"; DestDir: "{app}\support"; Flags: ignoreversion
Source: "support\InstallGuide.html"; DestDir: "{app}\support"; Flags: ignoreversion
Source: "README.md"; DestDir: "{app}"; DestName: "WINDOWS-INSTALLER-README.txt"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\PopShield Install Guide"; Filename: "{app}\support\InstallGuide.html"
Name: "{autoprograms}\Open PopShield Extension Folder"; Filename: "{app}\Extension"
Name: "{autoprograms}\Launch PopShield Browser Helper"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\support\LaunchInstallHelper.ps1"" -ExtensionPath ""{app}\Extension"" -GuidePath ""{app}\support\InstallGuide.html"""; IconFilename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\support\LaunchInstallHelper.ps1"" -ExtensionPath ""{app}\Extension"" -GuidePath ""{app}\support\InstallGuide.html"""; Flags: postinstall skipifsilent; Description: "Open the install guide, extension folder, and browser extensions page"
