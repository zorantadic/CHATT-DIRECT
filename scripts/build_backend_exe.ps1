$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$backendDir = Join-Path $repoRoot "backend"
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"
$specPath = Join-Path $backendDir "chatt-backend.spec"
$buildDir = Join-Path $backendDir "build"
$distAppDir = Join-Path $backendDir "dist\chatt-backend"
$exePath = Join-Path $distAppDir "chatt-backend.exe"

$templateFiles = @(
    "provider_capabilities.json",
    "provider_config.local.example.json",
    "scenario_presets.json"
)

function Invoke-CheckedNative {
    param(
        [Parameter(Mandatory = $true)]
        [string] $FilePath,

        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($Arguments -join ' ')"
    }
}

Write-Host "[chatt-backend] Repo root: $repoRoot"
Write-Host "[chatt-backend] Backend dir: $backendDir"

if (-not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    throw "Backend virtualenv Python was not found: $pythonExe"
}

if (-not (Test-Path -LiteralPath $specPath -PathType Leaf)) {
    throw "PyInstaller spec was not found: $specPath"
}

Push-Location $backendDir
try {
    Write-Host "[chatt-backend] Checking PyInstaller..."
    $pyInstallerAvailable = $false
    try {
        $null = & $pythonExe -m PyInstaller --version 2>$null
        $pyInstallerAvailable = ($LASTEXITCODE -eq 0)
    }
    catch {
        $pyInstallerAvailable = $false
    }

    if (-not $pyInstallerAvailable) {
        Write-Host "[chatt-backend] PyInstaller not found in backend venv. Installing..."
        Invoke-CheckedNative -FilePath $pythonExe -Arguments @("-m", "pip", "install", "pyinstaller")
    }

    if (Test-Path -LiteralPath $buildDir) {
        Write-Host "[chatt-backend] Cleaning $buildDir"
        Remove-Item -LiteralPath $buildDir -Recurse -Force
    }

    if (Test-Path -LiteralPath $distAppDir) {
        Write-Host "[chatt-backend] Cleaning $distAppDir"
        Remove-Item -LiteralPath $distAppDir -Recurse -Force
    }

    Write-Host "[chatt-backend] Building PyInstaller one-folder backend..."
    Invoke-CheckedNative -FilePath $pythonExe -Arguments @("-m", "PyInstaller", ".\chatt-backend.spec", "--noconfirm")

    foreach ($fileName in $templateFiles) {
        $sourcePath = Join-Path $backendDir $fileName
        $targetPath = Join-Path $distAppDir $fileName

        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Required backend template file is missing: $sourcePath"
        }

        Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    }

    if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
        throw "Build completed but executable was not found: $exePath"
    }

    Write-Host "[chatt-backend] Build succeeded: $exePath"
}
finally {
    Pop-Location
}
