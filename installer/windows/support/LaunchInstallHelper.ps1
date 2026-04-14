param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionPath,

    [Parameter(Mandatory = $true)]
    [string]$GuidePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Start-IfExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [string]$ArgumentList
    )

    if (Test-Path $Path) {
        if ($ArgumentList) {
            Start-Process -FilePath $Path -ArgumentList $ArgumentList | Out-Null
        } else {
            Start-Process -FilePath $Path | Out-Null
        }
        return $true
    }

    return $false
}

if (Test-Path $GuidePath) {
    Start-Process -FilePath $GuidePath | Out-Null
}

if (Test-Path $ExtensionPath) {
    Start-Process -FilePath "explorer.exe" -ArgumentList "`"$ExtensionPath`"" | Out-Null
}

$chromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and $_.Trim() -ne "" }

$edgeCandidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and $_.Trim() -ne "" }

$openedBrowser = $false

foreach ($chromePath in $chromeCandidates) {
    if (Start-IfExists -Path $chromePath -ArgumentList "chrome://extensions/") {
        $openedBrowser = $true
        break
    }
}

if (-not $openedBrowser) {
    foreach ($edgePath in $edgeCandidates) {
        if (Start-IfExists -Path $edgePath -ArgumentList "edge://extensions/") {
            $openedBrowser = $true
            break
        }
    }
}

if (-not $openedBrowser) {
    Start-Process -FilePath "https://support.google.com/chrome_webstore/answer/2664769?hl=en" | Out-Null
}
