const { spawn } = require("child_process");

function reconhecerVoz() {
    if (process.platform !== "win32") {
        return Promise.reject(new Error("O reconhecimento nativo está disponível apenas no Windows."));
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
$engine = $null
try {
    Add-Type -AssemblyName System.Speech
    $info = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() |
        Where-Object { $_.Culture.Name -eq 'pt-PT' } | Select-Object -First 1
    if (-not $info) {
        @{ ok = $false; error = 'O Windows não tem um reconhecedor de fala pt-PT instalado. Verifique os recursos de fala do Português (Portugal) em Configurações > Hora e idioma > Idioma e região > Opções de idioma.' } | ConvertTo-Json -Compress
        exit 0
    }
    $engine = New-Object -TypeName System.Speech.Recognition.SpeechRecognitionEngine -ArgumentList $info
    $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    $engine.SetInputToDefaultAudioDevice()
    $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(8)
    $engine.EndSilenceTimeout = [TimeSpan]::FromSeconds(0.8)
    $result = $engine.Recognize([TimeSpan]::FromSeconds(20))
    if ($result -and $result.Text) {
        @{ ok = $true; text = $result.Text } | ConvertTo-Json -Compress
    } else {
        @{ ok = $false; error = 'Não ouvi nenhuma fala. Tente novamente.' } | ConvertTo-Json -Compress
    }
} catch {
    @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
} finally {
    if ($engine) { $engine.Dispose() }
}`;
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");

    return new Promise((resolve, reject) => {
        const powershell = spawn("powershell.exe", [
            "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-EncodedCommand", encodedScript
        ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

        let stdout = "";
        let stderr = "";
        powershell.stdout.setEncoding("utf8");
        powershell.stderr.setEncoding("utf8");
        powershell.stdout.on("data", chunk => { stdout += chunk; });
        powershell.stderr.on("data", chunk => { stderr += chunk; });
        powershell.on("error", () => reject(new Error("Não consegui iniciar o reconhecimento de voz do Windows.")));
        powershell.on("close", code => {
            let result;
            try {
                result = JSON.parse(stdout.trim());
            } catch {
                reject(new Error(stderr.trim() || `O reconhecimento do Windows terminou com erro (${code}).`));
                return;
            }
            if (result.ok && typeof result.text === "string") resolve(result.text);
            else reject(new Error(result.error || "Não consegui reconhecer sua fala."));
        });
    });
}

module.exports = { reconhecerVoz };
