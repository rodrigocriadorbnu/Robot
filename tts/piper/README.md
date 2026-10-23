# Piper TTS local

- Piper: `piper-tts` 1.8.0, versão mantida pelo projeto OHF-Voice.
- Voz: `pt_BR-faber-medium` (português do Brasil, qualidade média).
- Os arquivos do modelo e da configuração ficam nesta pasta.
- O ambiente virtual `.venv` guarda Piper e suas dependências sem instalar Piper globalmente.
- O instalador inclui o runtime compilado do Piper e este modelo; Python não é necessário na máquina de destino.
- O build do instalador usa Python 3.13 no Windows e empacota o runtime com PyInstaller.

## Teste independente

Na raiz do projeto, execute:

```powershell
.\tts\piper\.venv\Scripts\python.exe -m piper --model pt_BR-faber-medium --data-dir tts/piper --output-file tts/piper/teste.wav -- 'Olá Rodrigo! Eu sou o seu robô virtual.'
```

O WAV de teste foi gerado e reproduzido com o reprodutor nativo do Windows.

## Referências e origem

- Piper mantido: <https://github.com/OHF-Voice/piper1-gpl>, licença GPL-3.0.
- Voz: <https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR/faber/medium> (cartão do modelo: dataset CC0).
- O Piper anterior de `rhasspy/piper` foi arquivado; esta instalação usa a continuação mantida em `OHF-Voice/piper1-gpl`.
