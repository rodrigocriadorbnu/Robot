const robo =
    document.getElementById("robo");

const cabeca =
    document.getElementById("cabeca");

const cabecaImagem =
    document.getElementById("cabeca-imagem");

const bracoEsquerdo =
    document.getElementById("braco-esquerdo");

const bracoDireito =
    document.getElementById("braco-direito");

const pernaEsquerda =
    document.getElementById("perna-esquerda");

const pernaDireita =
    document.getElementById("perna-direita");

const maoEsquerda =
    document.getElementById("mao-esquerda");

const maoDireita =
    document.getElementById("mao-direita");

let sorrindo = false;
let expressaoAtual = "normal";
let conversaAtiva = false;
let acaoAtiva = "nenhuma";

const estadoEl = document.getElementById("estado");
const balaoFala = document.getElementById("balao-fala");
const campoMensagem = document.getElementById("mensagem");
const botaoMicrofone = document.getElementById("botao-microfone");
const botaoEnviar = document.getElementById("botao-enviar");
let temporizadorBalao;
let temporizadorExpressaoFala;

function reconhecerPeloNavegador() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        return Promise.reject(new Error("O reconhecimento de fala do navegador não está disponível."));
    }

    return new Promise((resolve, reject) => {
        const reconhecimento = new SpeechRecognition();
        reconhecimento.lang = "pt-PT";
        reconhecimento.continuous = false;
        reconhecimento.interimResults = false;
        reconhecimento.maxAlternatives = 1;

        reconhecimento.onresult = event => {
            const texto = event.results?.[0]?.[0]?.transcript?.trim();
            if (texto) resolve(texto);
            else reject(new Error("Não consegui entender o que você disse. Tente novamente."));
        };
        reconhecimento.onerror = event => {
            const mensagens = {
                "not-allowed": "O acesso ao microfone foi bloqueado. Libere o microfone nas configurações de privacidade do Windows.",
                "audio-capture": "Não encontrei um microfone disponível no Windows.",
                "network": "O reconhecimento de fala do navegador não conseguiu se conectar."
            };
            reject(new Error(mensagens[event.error] || `Falha no reconhecimento de fala (${event.error}).`));
        };
        reconhecimento.onnomatch = () => reject(new Error("Não consegui entender o que você disse. Tente novamente."));
        reconhecimento.onend = () => {
            if (!concluido) reject(new Error("Não ouvi nenhuma fala. Tente novamente."));
        };

        let concluido = false;
        const resolver = resolve;
        const rejeitar = reject;
        resolve = valor => { concluido = true; resolver(valor); };
        reject = erro => { concluido = true; rejeitar(erro); };

        try {
            reconhecimento.start();
        } catch (erro) {
            reject(new Error(`Não consegui iniciar o microfone: ${erro.message}`));
        }
    });
}

async function reconhecerVoz() {
    try {
        return await window.roboAPI.reconhecerVoz();
    } catch (erroNativo) {
        try {
            return await reconhecerPeloNavegador();
        } catch (erroNavegador) {
            throw new Error(`${erroNativo.message} ${erroNavegador.message}`);
        }
    }
}

function imagemDaExpressao(expressao) {
    const imagens = {
        normal: "assets/robo/olhos-normal.png",
        bravo: "assets/robo/olhos-bravo.png",
        surpreso: "assets/robo/olhos-surpresa.png",
        sonolento: "assets/robo/olhos-sono.png",
        triste: "assets/robo/olhos-triste.png",
        encantado: "assets/robo/olhos-encantado.png",
        sabedoria: "assets/robo/olhos-sabedoria.png"
    };

    if (expressao === "feliz") return "assets/robo/sorriso.png";
    return imagens[expressao] || imagens.normal;
}

function definirEstado(texto) {
    estadoEl.textContent = `â— ${texto}`;
}

function mostrarFala(texto) {
    balaoFala.textContent = texto;
    balaoFala.hidden = false;
    clearTimeout(temporizadorBalao);
    temporizadorBalao = setTimeout(() => { balaoFala.hidden = true; }, 9000);
}

function aplicarExpressao(expressao) {
    expressaoAtual = expressao;
    sorrindo = expressao === "feliz";
    if (!conversaAtiva) {
        cabecaImagem.src = imagemDaExpressao(expressaoAtual);
    }
}

window.roboAPI.onAnimacaoRobo(animacao => {
    if (animacao.expressao) aplicarExpressao(animacao.expressao);
    conversaAtiva = Boolean(animacao.falando);
    clearInterval(temporizadorExpressaoFala);
    if (conversaAtiva) {
        temporizadorExpressaoFala = setInterval(() => {
            cabecaImagem.src = cabecaImagem.src.endsWith("sorriso.png")
                ? imagemDaExpressao(expressaoAtual)
                : "assets/robo/sorriso.png";
        }, 450);
    } else {
        cabecaImagem.src = imagemDaExpressao(expressaoAtual);
    }
});

async function enviarMensagem(texto) {
    const mensagem = texto.trim();
    if (!mensagem) return;

    conversaAtiva = true;
    botaoEnviar.disabled = true;
    botaoMicrofone.disabled = true;
    definirEstado("Pensando...");
    try {
        const resposta = await window.roboAPI.conversar(mensagem);
        aplicarExpressao(resposta.expressao);
        acaoAtiva = resposta.acao;
        setTimeout(() => { acaoAtiva = "nenhuma"; }, 1800);
        mostrarFala(resposta.fala);
        definirEstado("Falando...");
        cabecaImagem.src = "assets/robo/sorriso.png";
        temporizadorExpressaoFala = setInterval(() => {
            cabecaImagem.src = cabecaImagem.src.endsWith("sorriso.png")
                ? imagemDaExpressao(expressaoAtual)
                : "assets/robo/sorriso.png";
        }, 450);
        try {
            await window.roboAPI.falar(resposta.fala);
            definirEstado("Pronto");
            campoMensagem.value = "";
            clearTimeout(temporizadorBalao);
            balaoFala.hidden = true;
        } catch (erroVoz) {
            definirEstado(`Resposta pronta (voz indisponÃ­vel: ${erroVoz.message})`);
        }
    } catch (erro) {
        const recado = erro.message || "Algo deu errado na conversa.";
        mostrarFala(`Ops! ${recado}`);
        definirEstado("NÃ£o consegui responder");
    } finally {
        clearInterval(temporizadorExpressaoFala);
        conversaAtiva = false;
        botaoEnviar.disabled = false;
        botaoMicrofone.disabled = false;
        cabecaImagem.src = imagemDaExpressao(expressaoAtual);
    }
}

botaoEnviar.addEventListener("click", () => {
    const texto = campoMensagem.value;
    campoMensagem.value = "";
    enviarMensagem(texto);
});

campoMensagem.addEventListener("keydown", event => {
    if (event.key === "Enter") botaoEnviar.click();
});

botaoMicrofone.addEventListener("click", async () => {
    if (botaoMicrofone.disabled || conversaAtiva) return;
    botaoMicrofone.disabled = true;
    definirEstado("Ouvindo pelo Windows...");
    try {
        const texto = await reconhecerVoz();
        campoMensagem.value = texto;
        await enviarMensagem(texto);
    } catch (erro) {
        mostrarFala(erro.message || "Não consegui reconhecer sua fala.");
        definirEstado("Pronto");
        botaoMicrofone.disabled = false;
    }
});
function piscar() {

    if (!sorrindo && !conversaAtiva) {
        cabecaImagem.src = "assets/robo/olhos-piscando.png";

        setTimeout(() => {
            if (!sorrindo) {
                cabecaImagem.src = imagemDaExpressao(expressaoAtual);
            }
        }, 180);
    }

    setTimeout(piscar, 2500 + Math.random() * 3000);

}

setTimeout(piscar, 2000);

function sorrirDeVezEmQuando() {
    if (conversaAtiva) {
        setTimeout(sorrirDeVezEmQuando, 3000);
        return;
    }
    // MantÃ©m o sorriso por um instante e depois volta Ã  expressÃ£o normal.
    sorrindo = true;
    cabecaImagem.src = "assets/robo/sorriso.png";

    setTimeout(() => {
        sorrindo = expressaoAtual === "feliz";
        cabecaImagem.src = imagemDaExpressao(expressaoAtual);

        // PrÃ³ximo sorriso entre 8 e 18 segundos.
        setTimeout(sorrirDeVezEmQuando, 8000 + Math.random() * 10000);
    }, 1200);
}

// Primeiro sorriso apÃ³s alguns segundos.
setTimeout(sorrirDeVezEmQuando, 5000 + Math.random() * 5000);

// ======================================
// CANVAS DO PROPULSOR
// ======================================

const canvas =
    document.getElementById(
        "particulas-propulsor"
    );

const ctx =
    canvas.getContext("2d");

canvas.width = 90;
canvas.height = 160;


// ======================================
// PARTÃƒÂCULAS
// ======================================

const particulas = [];


// ======================================
// CRIAR PARTÃƒÂCULA
// ======================================

function criarParticula() {

    particulas.push({

        // Ponto de saÃƒÂ­da da chama
        x: 45 + (Math.random() - 0.5) * 20,

        y: -23,

        velocidadeX:
            (Math.random() - 0.5) * 1.5,

        velocidadeY:
            3 + Math.random() * 4,

        tamanho:
            3 + Math.random() * 4,

        vida: 1

    });

}

function criarFumaca() {
    particulas.push({
        tipo: "fumaca",
        x: 45 + (Math.random() - 0.5) * 28,
        y: -23,
        velocidadeX: (Math.random() - 0.5) * 1.2,
        velocidadeY: 0.7 + Math.random() * 0.8,
        tamanho: 4 + Math.random() * 3,
        vida: 0.28 + Math.random() * 0.12
    });
}


// ======================================
// ATUALIZAR
// ======================================

function atualizarParticulas() {

    for (
        let i = particulas.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            particulas[i];


        p.x += p.velocidadeX;

        p.y += p.velocidadeY;


        // Pequena aceleraÃƒÂ§ÃƒÂ£o
        if (p.tipo === "fumaca") {
            p.velocidadeX += (Math.random() - 0.5) * 0.08;
            p.velocidadeX = Math.max(-1.8, Math.min(1.8, p.velocidadeX));
            p.tamanho += 0.055;
            p.vida -= 0.004;
        } else {
            p.velocidadeY += 0.06;
            p.vida -= 0.018;
            p.tamanho *= 0.985;
        }

        if (
            p.vida <= 0 ||
            (p.tipo !== "fumaca" && p.tamanho <= 0.5) ||
            p.y > canvas.height
        ) {

            particulas.splice(i, 1);

        }

    }

}


// ======================================
// DESENHAR
// ======================================

function desenharParticulas() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    for (
        const p of particulas
    ) {

        ctx.save();


        ctx.globalAlpha = p.vida;
        ctx.fillStyle = p.tipo === "fumaca" ? "#aeb8c2" : "#faa806";
        ctx.shadowColor = p.tipo === "fumaca" ? "transparent" : "#0088ff";
        ctx.shadowBlur = p.tipo === "fumaca" ? 0 : 12;


        ctx.beginPath();


        ctx.arc(
            p.x,
            p.y,
            p.tamanho,
            0,
            Math.PI * 2
        );


        ctx.fill();


        ctx.restore();

    }

}


// ======================================
// EMISSÃƒÆ’O
// ======================================

setInterval(() => {

    // VÃƒÂ¡rias partÃƒÂ­culas
    // para deixar a chama visÃƒÂ­vel

    criarParticula();
    criarParticula();

    // Uma pequena nuvem de fumaÃ§a acompanha a chama de vez em quando.
    if (Math.random() > 0.65) {
        criarFumaca();
    }

    if (Math.random() > 0.3) {
        criarParticula();
    }

}, 25);


// ======================================
// ANIMAÃƒâ€¡ÃƒÆ’O DO ROBÃƒâ€
// ======================================

let tempo = 0;


function animar() {

    tempo += 0.08;


    // -------------------------------
    // FLUTUAÃƒâ€¡ÃƒÆ’O
    // -------------------------------

    const flutuacao =
        Math.sin(tempo * 2) * 2.5;


    robo.style.transform =
        `translateY(${flutuacao}px)`;


    // -------------------------------
    // BRAÃƒâ€¡OS
    // -------------------------------

    const movimentoBracos =
        Math.sin(tempo) * 4;

    const aceno = acaoAtiva === "acenar" ? Math.sin(tempo * 7) * 22 : 0;


    bracoEsquerdo.style.transform =
        `rotate(${movimentoBracos + aceno}deg)`;


    bracoDireito.style.transform =
        `rotate(${-movimentoBracos + aceno}deg)`;

    const movimentoPernas = Math.sin(tempo * 2) * 6;
    pernaEsquerda.style.transform = `rotate(${-3 + movimentoPernas}deg)`;
    pernaDireita.style.transform = `rotate(${3 - movimentoPernas}deg)`;


    // -------------------------------
    // MÃƒÆ’OS
    // -------------------------------

    const movimentoMaos =
        Math.sin(tempo + 0.5) * 2;


    maoEsquerda.style.transform =
        `rotate(${movimentoMaos}deg)`;


    maoDireita.style.transform =
        `rotate(${-movimentoMaos}deg)`;


    // -------------------------------
    // CABEÃƒâ€¡A
    // -------------------------------

    const olhar = acaoAtiva === "olhar_esquerda" ? -18 : acaoAtiva === "olhar_direita" ? 18 : 0;
    const balanco = acaoAtiva === "balancar" ? Math.sin(tempo * 8) * 9 : 0;
    const movimentoCabeca = acaoAtiva === "olhar_para_usuario"
        ? 0
        : Math.sin(tempo * 0.7) * 3 + olhar + balanco;


    cabeca.style.transform =
        `rotate(${movimentoCabeca}deg)`;


    // -------------------------------
    // PARTÃƒÂCULAS
    // -------------------------------

    atualizarParticulas();

    desenharParticulas();


    requestAnimationFrame(
        animar
    );

}


animar();

