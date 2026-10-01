const fs = require("fs");
const path = require("path");
const memoryFile = path.join(require("electron").app.getPath("userData"), "memorias.json");

function carregarMemorias() {
    try {
        const data = JSON.parse(fs.readFileSync(memoryFile, "utf8"));
        return Array.isArray(data) ? data.filter(item => typeof item === "string").slice(0, 50) : [];
    } catch (error) {
        if (error.code !== "ENOENT") console.error("Não foi possível ler as memórias:", error);
        return [];
    }
}

function salvarMemorias(memorias) {
    const unique = new Map();
    for (const item of memorias) {
        if (typeof item !== "string" || !item.trim()) continue;
        const value = item.trim().slice(0, 180);
        const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        unique.set(key, value);
    }
    fs.mkdirSync(path.dirname(memoryFile), { recursive: true });
    fs.writeFileSync(memoryFile, JSON.stringify([...unique.values()].slice(-50), null, 2), "utf8");
}

function apagarMemorias() {
    try {
        fs.unlinkSync(memoryFile);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
}

module.exports = { carregarMemorias, salvarMemorias, apagarMemorias };
