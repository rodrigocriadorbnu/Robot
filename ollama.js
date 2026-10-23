const HISTORICO_MAXIMO = 12;
const TEMPO_LIMITE_MS = 120000;
const historico = [];

function obterConfiguracao() {
    const endereco = process.env.ROBO_OLLAMA_URL?.trim();
    const modelo = process.env.ROBO_OLLAMA_MODEL?.trim();
    if (!endereco || !modelo) return null;

    let url;
    try {
        url = new URL(`${endereco.replace(/\/+$/, "")}/api/chat`);
    } catch {
        throw new Error("ROBO_OLLAMA_URL precisa ser um endereço HTTP ou HTTPS válido.");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("ROBO_OLLAMA_URL precisa usar HTTP ou HTTPS e não pode conter credenciais.");
    }

    return { url, modelo };
}

async function processarComOllama(texto) {
    const configuracao = obterConfiguracao();
    if (!configuracao) return null;

    const mensagens = [
        {
            role: "system",
            content: "Você é o cérebro conversacional de um robô virtual de desktop. Responda em português, com clareza e cordialidade. Responda somente com texto que possa ser falado e não afirme executar ações no computador."
        },
        ...historico,
        { role: "user", content: texto }
    ];

    const resposta = await fetch(configuracao.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: configuracao.modelo,
            messages: mensagens,
            stream: false
        }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS)
    });
    if (!resposta.ok) {
        throw new Error(`O Ollama respondeu com HTTP ${resposta.status}.`);
    }

    const dados = await resposta.json();
    const conteudo = dados?.message?.content;
    if (typeof conteudo !== "string") {
        throw new Error("O Ollama retornou uma resposta em formato inválido.");
    }
    const fala = conteudo.trim();
    if (!fala || fala.length > 1200) {
        throw new Error("O Ollama retornou uma resposta vazia ou maior que o limite de fala.");
    }

    historico.push(
        { role: "user", content: texto },
        { role: "assistant", content: fala }
    );
    if (historico.length > HISTORICO_MAXIMO) {
        historico.splice(0, historico.length - HISTORICO_MAXIMO);
    }

    return {
        fala,
        resposta: fala,
        intencao: "ollama",
        expressao: "normal",
        acao: "nenhuma",
        fallback: false
    };
}

function limparHistoricoOllama() {
    historico.length = 0;
}

module.exports = { processarComOllama, limparHistoricoOllama };
