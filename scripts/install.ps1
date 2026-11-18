# FullStack Academy — one-line installer for Windows.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/DashAkoul/fullstack-academy/main/scripts/install.ps1 | iex"
#
# Optional: set $env:FSA_REPO to use a fork.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repo = if ($env:FSA_REPO) { $env:FSA_REPO } else { 'DashAkoul/fullstack-academy' }
$appName = 'FullStack Academy'

function Write-Step([string]$message) {
  Write-Host "==> $message" -ForegroundColor Cyan
}

Write-Step 'دریافت آخرین نسخه از GitHub...'
$release = Invoke-RestMethod `
  -Uri "https://api.github.com/repos/$repo/releases/latest" `
  -Headers @{ 'User-Agent' = 'FSA-Installer'; 'Accept' = 'application/vnd.github+json' }

if (-not $release -or -not $release.assets) {
  throw 'هیچ نسخه‌ی منتشرشده‌ای پیدا نشد.'
}

Write-Step "آخرین نسخه: $($release.tag_name)"

$setup = $release.assets | Where-Object { $_.name -match 'setup\.exe$' } | Select-Object -First 1
$portable = $release.assets | Where-Object { $_.name -match 'portable\.exe$' } | Select-Object -First 1

if (-not $setup -and -not $portable) {
  throw 'بسته‌ی ویندوز در این نسخه پیدا نشد.'
}

$tempFile = Join-Path $env:TEMP ($setup ? $setup.name : $portable.name)
Write-Step "دانلود $([System.IO.Path]::GetFileName($tempFile))..."
Invoke-WebRequest -Uri ($setup ? $setup.browser_download_url : $portable.browser_download_url) -OutFile $tempFile

$exePath = $null

if ($setup) {
  Write-Step 'نصب نسخه‌ی نصبی (بدون پرسش)...'
  Start-Process -FilePath $tempFile -ArgumentList '/S' -Wait
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\FullStack Academy\FullStack Academy.exe'),
    (Join-Path $env:PROGRAMFILES 'FullStack Academy\FullStack Academy.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'FullStack Academy\FullStack Academy.exe')
  )
  $exePath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
} else {
  $installDir = Join-Path $env:LOCALAPPDATA 'Programs\FullStackAcademy'
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null
  $exePath = Join-Path $installDir 'FullStack Academy.exe'
  Write-Step "نصب نسخه‌ی پرتابل در $installDir..."
  Copy-Item $tempFile $exePath -Force

  $shell = New-Object -ComObject WScript.Shell
  $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\FullStack Academy.lnk'
  $desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'FullStack Academy.lnk'
  foreach ($shortcutPath in @($startMenu, $desktop)) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $exePath
    $shortcut.WorkingDirectory = $installDir
    $shortcut.Description = 'FullStack Academy'
    $shortcut.Save()
  }
}

Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

if ($exePath -and (Test-Path $exePath)) {
  Write-Step 'نصب کامل شد. برنامه باز می‌شود...'
  Start-Process -FilePath $exePath
} else {
  Write-Step 'نصب انجام شد. برنامه را از منوی Start با نام FullStack Academy باز کنید.'
}
