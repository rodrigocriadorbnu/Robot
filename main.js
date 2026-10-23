const {
    app,
    BrowserWindow,
    screen,
    ipcMain,
    session
} = require("electron");

const path = require("path");
const { processarMensagem, limparHistorico } = require("./brain");
const { processarComOllama, limparHistoricoOllama } = require("./ollama");
const { falar } = require("./voice");
const { reconhecerVoz } = require("./speech");
const { apagarMemorias } = require("./memory");

let janela;
let janelaDialogo;

let roboX = 100;

let direcao = 1;
let cantoEstacionado = null;

const LARGURA = 260;
const ALTURA = 400;

const VELOCIDADE = 2;

const DISTANCIA_DO_FUNDO = -20;


function criarJanela() {

    janela = new BrowserWindow({

        width: LARGURA,
        height: ALTURA,

        frame: false,

        transparent: true,

        resizable: false,

        movable: false,

        alwaysOnTop: true,

        hasShadow: false,

        skipTaskbar: true,

        webPreferences: {

            preload: path.join(
                __dirname,
                "preload.js"
            ),

            nodeIntegration: false,

            contextIsolation: true

        }

    });


    janela.loadFile("index.html");


    janela.setBackgroundColor(
        "#00000000"
    );


    janela.setAlwaysOnTop(
        true,
        "floating"
    );


    iniciarMovimento();
}

function criarJanelaDialogo() {
    const tela = screen.getPrimaryDisplay();
    const largura = 390;
    const altura = 76;
    const margem = 18;
    janelaDialogo = new BrowserWindow({
        width: largura,
        height: altura,
        x: tela.workArea.x + tela.workArea.width - largura - margem,
        y: tela.workArea.y + tela.workArea.height - altura - margem,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    janelaDialogo.loadFile("dialog.html");
    janelaDialogo.setBackgroundColor("#00000000");
    janelaDialogo.setAlwaysOnTop(true, "floating");
}


function iniciarMovimento() {

    setInterval(() => {

        if (
            !janela ||
            janela.isDestroyed()
        ) {
            return;
        }


        const tela =
            screen.getPrimaryDisplay();


        const larguraTela =
            tela.workAreaSize.width;


        const alturaTela =
            tela.workAreaSize.height;


        const limiteDireito =
            larguraTela - LARGURA;


        if (cantoEstacionado === "esquerdo") {
            roboX = 0;
        } else if (cantoEstacionado === "direito") {
            roboX = limiteDireito;
        } else {
            // Movimento horizontal
            roboX += VELOCIDADE * direcao;
        }


        // Chegou na direita

        if (roboX >= limiteDireito) {

            roboX = limiteDireito;

            direcao = -1;

        }


        // Chegou na esquerda

        if (roboX <= 0) {

            roboX = 0;

            direcao = 1;

        }


        // Altura do robÃ´

        const roboY =
            alturaTela -
            ALTURA -
            DISTANCIA_DO_FUNDO;


        janela.setPosition(
            Math.round(roboX),
            Math.round(roboY)
        );


    }, 16);

}


app.whenReady().then(() => {

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(permission === "media" && webContents.getURL().startsWith("file://"));
    });

    ipcMain.handle("robo:reconhecer-voz", async () => {
        try {
            return { ok: true, text: await reconhecerVoz() };
        } catch (error) {
            return { ok: false, error: error.message || "Não consegui iniciar o reconhecimento de voz do Windows." };
        }
    });

    ipcMain.handle("robo:conversar", async (_event, mensagem) => {
        if (typeof mensagem !== "string" || !mensagem.trim() || mensagem.length > 2000) {
            throw new Error("Escreva uma mensagem curta para eu entender.");
        }
        const texto = mensagem.trim();
        const comando = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const querParar = /\b(fica|fique|ficar|pare|parar|parado|parada|estacione|estaciona|posicione|vai|va|mova|coloque)\b/.test(comando);
        const pedeEsquerda = querParar && /\b(esquerda|esquerdo)\b/.test(comando);
        const pedeDireita = querParar && /\b(direita|direito)\b/.test(comando);
        const pedeMovimento = /\b(pode|volta|volte|retome|comeca|comece)\b.{0,35}\b(andar|movimentar|movimento|mexer|mecher|mover)\b/.test(comando)
            || /\b(se mexe|se move|ande|mexa-se|movimente-se)\b/.test(comando);

        if (pedeEsquerda || pedeDireita) {
            cantoEstacionado = pedeEsquerda ? "esquerdo" : "direito";
            const lado = cantoEstacionado === "esquerdo" ? "esquerdo" : "direito";
            return { fala: `Certo, vou ficar parado no canto ${lado} até você pedir para eu me mexer.`, expressao: "feliz", acao: "nenhuma", intencao: "movimento" };
        }
        if (pedeMovimento) {
            cantoEstacionado = null;
            return { fala: "Certo, voltei a andar. Se eu atrapalhar, é só pedir para eu parar num canto.", expressao: "feliz", acao: "nenhuma", intencao: "retorno" };
        }

        if (/^(esquece|esqueça|apague|apagar) (tudo|todas as memórias|o que você lembra)( de mim)?[.! ]*$/i.test(texto)) {
            apagarMemorias();
            limparHistorico();
            limparHistoricoOllama();
            return { fala: "Pronto, apaguei as informações que eu lembrava sobre você.", expressao: "feliz", acao: "nenhuma", intencao: "memoria" };
        }

        try {
            const respostaOllama = await processarComOllama(texto);
            if (respostaOllama) return respostaOllama;
        } catch (erro) {
            console.error("Não foi possível conversar com o Ollama; usando as respostas locais:", erro.message);
        }

        return processarMensagem(texto);
    });

    ipcMain.handle("robo:falar", async (_event, texto) => {
        if (typeof texto !== "string" || !texto.trim() || texto.length > 1200) {
            throw new Error("Não recebi um texto válido para falar.");
        }
        await falar(texto);
        return true;
    });

    ipcMain.on("robo:animacao", (_event, animacao) => {
        if (janela && !janela.isDestroyed()) janela.webContents.send("robo:animacao", animacao);
    });

    criarJanela();
    criarJanelaDialogo();
    setTimeout(() => {
        falar("Olá Rodrigo! Estou funcionando!").catch(erro => {
            console.error("O teste inicial do Piper falhou:", erro.message);
        });
    }, 1200);

});


app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);
