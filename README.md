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

Com Node.js, Python 3.13 instalado e conexão à internet para baixar os componentes de build:

```powershell
npm.cmd install
npm.cmd run dist
```

O build prepara o runtime Piper com PyInstaller e inclui o motor de fala e o modelo `pt_BR-faber-medium` no instalador Windows x64, salvo em `dist\Robo Virtual Setup 1.0.0.exe`. Python não é necessário no computador onde o instalador será executado.

## Inteligência conversacional (Ollama)

O robô pode usar um Ollama já em execução. Configure o endereço-base HTTP/HTTPS e o identificador de um modelo disponível como variáveis de ambiente antes de iniciar o aplicativo:

```powershell
$env:ROBO_OLLAMA_URL = "http://<endereco-do-seu-ollama>"
$env:ROBO_OLLAMA_MODEL = "<identificador-do-modelo>"
npm.cmd start
```

O aplicativo acrescenta `/api/chat` ao endereço-base. Para o instalador, defina as variáveis no ambiente do Windows antes de abrir o robô; reinicie o aplicativo após alterar a configuração. Se alguma variável não estiver definida ou o Ollama não responder, o robô usa as respostas locais existentes. Os comandos de movimento e de limpeza de memória continuam sendo tratados localmente antes de qualquer chamada ao modelo.

## Voz

O robô usa a voz Piper `pt_BR-faber-medium`, em português brasileiro. No desenvolvimento, instale o runtime local com:
```powershell
python -m venv tts\piper\.venv
tts\piper\.venv\Scripts\python.exe -m pip install -r requirements-piper.txt
npm.cmd run test:piper
```

Se o Piper falhar, a fala usa a voz do Windows como fallback. Para reconhecimento de fala, o projeto usa o reconhecedor pt-PT do Windows; instale os recursos de fala do Português (Portugal) em **Configurações > Hora e idioma > Idioma e região > Opções de idioma**.
