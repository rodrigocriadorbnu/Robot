const campo = document.getElementById("mensagem-dialogo");
const enviar = document.getElementById("botao-enviar-dialogo");
const autoEnvio = document.getElementById("botao-auto-dialogo");
let conversaAtiva = false;
let envioAutomaticoAtivo = false;
let temporizadorEnvio;

function agendarEnvioAutomatico() {
    clearTimeout(temporizadorEnvio);
    if (!envioAutomaticoAtivo || conversaAtiva || !campo.value.trim()) return;
    temporizadorEnvio = setTimeout(() => {
        if (!conversaAtiva) enviarMensagem(campo.value);
    }, 5000);
}

async function enviarMensagem(texto) {
    texto = texto.trim();
    if (!texto || conversaAtiva) return;
    clearTimeout(temporizadorEnvio);
    conversaAtiva = true;
    enviar.disabled = true;
    window.roboAPI.animarRobo({ falando: true });
    try {
        const resposta = await window.roboAPI.conversar(texto);
        window.roboAPI.animarRobo({ expressao: resposta.expressao, falando: true });
        await window.roboAPI.falar(resposta.fala);
        campo.value = "";
    } catch (erro) {
        console.error("Falha na conversa com o robô:", erro);
    } finally {
        window.roboAPI.animarRobo({ falando: false });
        conversaAtiva = false;
        enviar.disabled = false;
    }
}

enviar.addEventListener("click", () => {
    const texto = campo.value;
    campo.value = "";
    enviarMensagem(texto);
});

campo.addEventListener("keydown", evento => {
    if (evento.key === "Enter") enviar.click();
});

campo.addEventListener("input", agendarEnvioAutomatico);

autoEnvio.addEventListener("click", () => {
    envioAutomaticoAtivo = !envioAutomaticoAtivo;
    autoEnvio.setAttribute("aria-pressed", String(envioAutomaticoAtivo));
    autoEnvio.classList.toggle("ativo", envioAutomaticoAtivo);
    autoEnvio.title = envioAutomaticoAtivo
        ? "Envio automático ativo: envia após 5 segundos sem texto"
        : "Ativar envio automático após 5 segundos sem texto";
    clearTimeout(temporizadorEnvio);
    if (envioAutomaticoAtivo) agendarEnvioAutomatico();
});

