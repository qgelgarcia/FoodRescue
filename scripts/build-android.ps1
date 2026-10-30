$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $workspaceRoot 'apps/frontend'
Push-Location $workspaceRoot
try {
    npm run android:sync --workspace=@foodrescue/frontend
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build or Capacitor sync failed.' }
    Push-Location (Join-Path $frontendPath 'android')
    try {
        & ./gradlew.bat assembleDebug --no-daemon
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed. Check JAVA_HOME (JDK 21) and ANDROID_HOME.' }
    } finally { Pop-Location }
    $apkSource = Join-Path $frontendPath 'android/app/build/outputs/apk/debug/app-debug.apk'
    $outputPath = Join-Path $workspaceRoot 'output/release'
    New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
    Copy-Item -LiteralPath $apkSource -Destination (Join-Path $outputPath 'FoodRescue-debug.apk')
    Write-Output "APK: $outputPath/FoodRescue-debug.apk"
} finally { Pop-Location }
