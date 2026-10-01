# Robô Virtual

Aplicativo de desktop para Windows, feito com Electron.

## Instalar e abrir

Execute `dist\Robo Virtual Setup 1.0.0.exe` e conclua o instalador. Ele cria atalhos no menu Iniciar e na área de trabalho.

Para abrir o projeto em modo de desenvolvimento, instale Node.js e execute na pasta do projeto:

```powershell
npm.cmd install
npm.cmd start
```

## Gerar um novo instalador

Com Node.js instalado e conexão à internet disponível para baixar os componentes de build:

```powershell
npm.cmd install
npm.cmd run dist
```

O instalador Windows x64 será salvo em `dist\Robo Virtual Setup 1.0.0.exe`.

## Voz

O instalador usa a voz de síntese de fala do Windows. O Piper local incluído no ambiente de desenvolvimento não é copiado para o instalador. Para reconhecimento de fala, o projeto usa o reconhecedor pt-PT do Windows; instale os recursos de fala do Português (Portugal) em **Configurações > Hora e idioma > Idioma e região > Opções de idioma**.
