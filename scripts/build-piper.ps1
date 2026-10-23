$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$pastaPiper = Join-Path $raiz "tts\piper"
$python = Join-Path $pastaPiper ".venv\Scripts\python.exe"
$requisitos = Join-Path $raiz "requirements-piper.txt"
$runner = Join-Path $pastaPiper "piper_runner.py"
$dist = Join-Path $pastaPiper "dist"
$work = Join-Path $pastaPiper "build"

if (-not (Test-Path $python)) {
    $pythonSistema = Get-Command python -ErrorAction Stop
    & $pythonSistema.Source -m venv (Join-Path $pastaPiper ".venv")
    if ($LASTEXITCODE -ne 0) { throw "Não consegui criar o ambiente virtual do Piper." }
}

& $python -m pip install --disable-pip-version-check -r $requisitos
if ($LASTEXITCODE -ne 0) { throw "Não consegui instalar os componentes do Piper." }

& $python -m PyInstaller `
    --noconfirm `
    --clean `
    --onedir `
    --console `
    --name piper `
    --distpath $dist `
    --workpath $work `
    --specpath $work `
    --collect-all piper `
    --collect-all onnxruntime `
    $runner
if ($LASTEXITCODE -ne 0) { throw "Não consegui gerar o runtime Piper para o instalador." }

$executavel = Join-Path $dist "piper\piper.exe"
if (-not (Test-Path $executavel)) { throw "O build terminou sem criar $executavel." }

Write-Output "Runtime Piper criado: $executavel"
