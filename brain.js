const respostasPorIntencao = require("./respostas.json");

const expressoesValidas = new Set(["normal", "feliz", "bravo", "surpreso", "sonolento", "triste", "encantado", "sabedoria"]);
const acoesValidas = new Set(["nenhuma", "balancar", "olhar_esquerda", "olhar_direita", "acenar", "olhar_para_usuario"]);
const nomeUsuario = process.env.ROBO_NOME_USUARIO?.trim() || "amigo";
const historico = [];
let ultimaIntencao = null;
let ultimoAssunto = null;

// Variações de abertura tornam as respostas menos repetitivas sem rede ou processamento pesado.
for (const item of Object.values(respostasPorIntencao)) {
    const base = [...item.respostas];
    item.respostas = [...new Set(base.flatMap(resposta => {
        const minuscula = resposta.charAt(0).toLowerCase() + resposta.slice(1);
        return [resposta, `Ah, ${minuscula}`, `Olha, ${minuscula}`];
    }))];
}

function normalizar(texto) {
    return String(texto ?? "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, " ")
        .replace(/\s+/g, " ").trim();
}

function distancia(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const atual = [i];
        let minimo = i;
        for (let j = 1; j <= b.length; j++) {
            atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            minimo = Math.min(minimo, atual[j]);
        }
        if (minimo > 1) return 2;
        anterior = atual;
    }
    return anterior[b.length];
}

function temGatilho(texto, gatilho) {
    const palavras = texto.split(" ");
    const partes = gatilho.split(" ");
    if (partes.length === 1) {
        if (palavras.includes(gatilho)) return true;
        return partes[0].length >= 5 && palavras.some(palavra => palavra.length >= 5 && distancia(palavra, partes[0]) === 1);
    }
    if (texto.includes(gatilho)) return true;
    if (partes.length === 2) {
        return palavras.some((palavra, indice) => palavra === partes[0]
            && palavras.slice(indice + 1, indice + 4).some((seguinte, deslocamento) =>
                seguinte === partes[1] || (partes[1].length >= 5 && seguinte.length >= 5 && distancia(seguinte, partes[1]) === 1 && deslocamento < 3)));
    }
    return false;
}

function identificarIntencao(frase, normalizada) {
    // Perguntas explícitas vencem palavras emocionais soltas ("você está bravo?").
    if (/\b(voce|tu) (esta|tens|tem|sente|sentes|fica|ficas)\b/.test(normalizada)
        && /\b(bravo|brava|feliz|triste|surpreso|surpresa|medo|sono|sentimento|sentimentos)\b/.test(normalizada)) {
        return "pergunta_sobre_emocao";
    }
    if (/\b(ele|ela|dele|dela|disso)\b/.test(normalizada) && ultimaIntencao === "pergunta_nome") return "seguimento_nome";

    const candidatos = [];
    for (const [intencao, item] of Object.entries(respostasPorIntencao)) {
        for (const gatilho of item.gatilhos) {
            if (temGatilho(normalizada, normalizar(gatilho))) {
                candidatos.push({ intencao, prioridade: item.prioridade || 0, tamanho: gatilho.length });
            }
        }
    }
    candidatos.sort((a, b) => b.prioridade - a.prioridade || b.tamanho - a.tamanho);
    if (candidatos.length) return candidatos[0].intencao;

    // Frases como "e você?" retomam a última conversa para uma resposta contextual.
    if (/^(e voce|e tu|e ele|e ela)$/.test(normalizada) && ultimoAssunto) return "seguimento_contexto";
    return null;
}

function escolher(lista, anterior) {
    if (!lista?.length) return "";
    if (lista.length === 1) return lista[0];
    let indice = Math.floor(Math.random() * lista.length);
    if (lista[indice] === anterior) indice = (indice + 1 + Math.floor(Math.random() * (lista.length - 1))) % lista.length;
    return lista[indice];
}

function preencherVariaveis(texto) {
    return texto.replace(/\{nome\}/g, nomeUsuario);
}

function processarComIA(_texto) {
    // Ponto de extensão para integração futura; nenhuma chamada externa é feita nesta versão.
    return null;
}

function limparHistorico() {
    historico.length = 0;
    ultimaIntencao = null;
    ultimoAssunto = null;
}

function processarMensagem(frase) {
    const texto = String(frase ?? "").trim().slice(0, 2000);
    const normalizada = normalizar(texto);
    const intencao = identificarIntencao(texto, normalizada);
    const chave = intencao || "fallback";
    const item = respostasPorIntencao[chave] || respostasPorIntencao.fallback;
    const fala = preencherVariaveis(escolher(item.respostas, historico.at(-1)?.fala));

    historico.push({ usuario: texto, fala, intencao: chave });
    if (historico.length > 12) historico.shift();
    ultimaIntencao = chave;
    ultimoAssunto = chave === "pergunta_nome" ? "meu nome" : chave;

    return {
        fala,
        resposta: fala,
        intencao: chave,
        expressao: expressoesValidas.has(item.expressao) ? item.expressao : "normal",
        acao: acoesValidas.has(item.acao) ? item.acao : "nenhuma",
        fallback: !intencao,
        historico: historico.map(({ usuario, fala: resposta }) => ({ usuario, resposta }))
    };
}

module.exports = { processarMensagem, processarComIA, limparHistorico, normalizar };
