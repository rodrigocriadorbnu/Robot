const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "roboAPI",
    {

        onDirecao: (callback) => {

            ipcRenderer.on(
                "direcao-robo",
                (event, direcao) => {

                    callback(direcao);

                }
            );

        },

        conversar: (mensagem) => ipcRenderer.invoke("robo:conversar", mensagem),

        reconhecerVoz: async () => {
            const resultado = await ipcRenderer.invoke("robo:reconhecer-voz");
            if (!resultado.ok) throw new Error(resultado.error);
            return resultado.text;
        },

        falar: (texto) => ipcRenderer.invoke("robo:falar", texto),
        animarRobo: (animacao) => ipcRenderer.send("robo:animacao", animacao),
        onAnimacaoRobo: (callback) => ipcRenderer.on("robo:animacao", (_event, animacao) => callback(animacao))

    }
);
