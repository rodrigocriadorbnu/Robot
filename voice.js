const { spawn } = require("child_process");
const { existsSync, statSync, unlinkSync, writeFileSync } = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");

const diretorioPiper = path.join(__dirname, "tts", "piper");
const python = path.join(diretorioPiper, ".venv", "Scripts", "python.exe");
const voz = "pt_BR-faber-medium";
const modelo = path.join(diretorioPiper, `${voz}.onnx`);
const configuracao = `${modelo}.json`;
let filaDeFalas = Promise.resolve();

function executar(comando, argumentos, opcoes = {}) {
    return new Promise((resolve, reject) => {
        const processo = spawn(comando, argumentos, {
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            ...opcoes
        });
        let stdout = "";
        let stderr = "";
        processo.stdout.setEncoding("utf8");
        processo.stderr.setEncoding("utf8");
        processo.stdout.on("data", trecho => { stdout += trecho; });
        processo.stderr.on("data", trecho => { stderr += trecho; });
        processo.on("error", erro => reject(new Error(
            `Falha ao iniciar ${comando}: ${erro.message}\nCaminho: ${comando}\nArgumentos: ${JSON.stringify(argumentos)}`
        )));
        processo.on("close", codigo => {
            if (codigo === 0) resolve({ stdout, stderr });
            else reject(new Error(
                `Comando falhou com código ${codigo}: ${comando} ${argumentos.map(arg => JSON.stringify(arg)).join(" ")}\n` +
                `Diretório: ${opcoes.cwd || process.cwd()}\nSaída: ${stdout.trim()}\nErro: ${stderr.trim() || "sem detalhes no stderr"}`
            ));
        });
    });
}

function verificarArquivos() {
    if (process.platform !== "win32") throw new Error("O Piper configurado neste projeto usa reprodução de áudio do Windows.");
    if (!existsSync(python)) throw new Error(`Python do ambiente local não encontrado: ${python}. Reinstale Piper em tts/piper/.venv.`);
    if (!existsSync(modelo)) throw new Error(`Modelo Piper não encontrado: ${modelo}`);
    if (!existsSync(configuracao)) throw new Error(`Configuração da voz Piper não encontrada: ${configuracao}`);
}

async function reproduzirWav(arquivo) {
    const caminhoCodificado = Buffer.from(arquivo, "utf8").toString("base64");
    const script = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
$caminhoCodificado = '${caminhoCodificado}'
$arquivo = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($caminhoCodificado))
if (-not (Test-Path -LiteralPath $arquivo -PathType Leaf)) { throw "Arquivo WAV não encontrado: $arquivo" }
$player = New-Object System.Media.SoundPlayer($arquivo)
try { $player.PlaySync() } finally { $player.Dispose() }
`;
    const codigo = Buffer.from(script, "utf16le").toString("base64");
    const comando = path.join(process.env.WINDIR || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    await executar(comando, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codigo]);
}

async function falarComVozDoWindows(texto) {
    const textoCodificado = Buffer.from(texto, "utf8").toString("base64");
    const script = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$texto = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${textoCodificado}'))
$sintetizador = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $vozes = @($sintetizador.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'pt-*' })
    $voz = $vozes | Where-Object { $_.VoiceInfo.Culture.Name -eq 'pt-PT' } | Select-Object -First 1
    if (-not $voz) { $voz = $vozes | Where-Object { $_.VoiceInfo.Culture.Name -eq 'pt-BR' } | Select-Object -First 1 }
    if ($voz) { $sintetizador.SelectVoice($voz.VoiceInfo.Name) }
    $sintetizador.Speak($texto)
} finally { $sintetizador.Dispose() }
`;
    const codigo = Buffer.from(script, "utf16le").toString("base64");
    const comando = path.join(process.env.WINDIR || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    await executar(comando, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codigo]);
}

function escaparXml(texto) {
    return texto.replace(/[<>&'\"]/g, caractere => ({
        "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
    })[caractere]);
}

function sintetizarComAzure(texto, arquivoAudio) {
    const chave = process.env.AZURE_SPEECH_KEY;
    const regiao = process.env.AZURE_SPEECH_REGION;
    const vozAzure = process.env.AZURE_SPEECH_VOICE || "pt-PT-RaquelNeural";
    if (!chave || !regiao) {
        return Promise.reject(new Error("Configure AZURE_SPEECH_KEY e AZURE_SPEECH_REGION para ativar Azure Speech."));
    }
    if (!/^[a-z0-9-]+$/i.test(regiao)) {
        return Promise.reject(new Error("AZURE_SPEECH_REGION deve ser o identificador da região Azure, por exemplo brazilsouth."));
    }

    const idioma = vozAzure.match(/^[a-z]{2}-[A-Z]{2}/)?.[0] || "pt-PT";
    const ssml = `<speak version="1.0" xml:lang="${idioma}"><voice name="${escaparXml(vozAzure)}">${escaparXml(texto)}</voice></speak>`;
    const corpo = Buffer.from(ssml, "utf8");
    const requisicao = https.request({
        hostname: `${regiao}.tts.speech.microsoft.com`,
        path: "/cognitiveservices/v1",
        method: "POST",
        headers: {
            "Ocp-Apim-Subscription-Key": chave,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
            "User-Agent": "RoboVirtualElectron",
            "Content-Length": corpo.length
        }
    }, resposta => {
        const partes = [];
        resposta.on("data", parte => partes.push(parte));
        resposta.on("end", () => {
            const conteudo = Buffer.concat(partes);
            if (resposta.statusCode < 200 || resposta.statusCode >= 300) {
                return rejeitar(new Error(`Azure Speech respondeu HTTP ${resposta.statusCode}: ${conteudo.toString("utf8").slice(0, 500)}`));
            }
            try {
                writeFileSync(arquivoAudio, conteudo);
                resolver();
            } catch (erro) {
                rejeitar(erro);
            }
        });
    });
    let resolver;
    let rejeitar;
    const resultado = new Promise((resolve, reject) => { resolver = resolve; rejeitar = reject; });
    requisicao.setTimeout(30000, () => requisicao.destroy(new Error("Tempo esgotado ao contactar Azure Speech.")));
    requisicao.on("error", erro => rejeitar(new Error(`Não consegui contactar Azure Speech: ${erro.message}`)));
    requisicao.end(corpo);
    return resultado;
}

async function falarAgora(texto) {
    let arquivoAudio;
    try {
        if (process.platform !== "win32") throw new Error("A reprodução configurada neste projeto requer Windows.");
        arquivoAudio = path.join(os.tmpdir(), `robo-piper-${process.pid}-${randomUUID()}.wav`);
        const argumentos = [
            "-m", "piper",
            "--model", voz,
            "--data-dir", diretorioPiper,
            "--output-file", arquivoAudio,
            "--", texto
        ];
        if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
            try {
                await sintetizarComAzure(texto, arquivoAudio);
                await reproduzirWav(arquivoAudio);
                return;
            } catch (erroAzure) {
                console.error(`[Azure Speech] Falha na síntese; vou tentar Piper. ${erroAzure.message}`);
            }
        }
        try {
            verificarArquivos();
            await executar(python, argumentos, { cwd: diretorioPiper });
        } catch (erroPiper) {
            console.warn(`[Piper TTS] Síntese local falhou. ${erroPiper.message}`);
            await falarComVozDoWindows(texto);
            return;
        }

        if (!existsSync(arquivoAudio) || statSync(arquivoAudio).size === 0) {
            throw new Error(`Piper terminou sem criar um WAV válido. Arquivo esperado: ${arquivoAudio}`);
        }
        await reproduzirWav(arquivoAudio);
    } catch (erro) {
        console.error(`[Piper TTS] ${erro.stack || erro.message}`);
        throw erro;
    } finally {
        if (arquivoAudio && existsSync(arquivoAudio)) {
            try { unlinkSync(arquivoAudio); } catch (erro) {
                console.error(`[Piper TTS] Não consegui apagar o áudio temporário ${arquivoAudio}: ${erro.message}`);
            }
        }
    }
}

function falar(texto) {
    const falaAtual = filaDeFalas.then(() => falarAgora(texto));
    // Uma falha não deve impedir as próximas falas da fila.
    filaDeFalas = falaAtual.catch(() => {});
    return falaAtual;
}

module.exports = { falar };
