# Cadastro de Motores 🔧

App **mobile-first (PWA)** para cadastrar motores elétricos **em campo**: coleta os dados e as
fotos do motor, **lê a placa de identificação por IA (Google Gemini)** e arquiva tudo de forma
padronizada no **Google Drive** — uma etapa por vez, igual a um assistente.

> Funciona **sem nenhuma chave de API**: nesse modo você digita os dados da placa manualmente
> e o cadastro é salvo localmente no servidor, com um **ZIP** para download. Configure as chaves
> para ligar a leitura automática da placa e o envio direto ao Drive.

## ✨ O que ele faz

Segue o fluxo obrigatório de cadastro:

1. Cliente → 2. Motor → 3. Foto da **placa** → 4. Foto **panorâmica** →
5. **Leitura da placa pela IA** (RPM, potência em CV/kW, rendimento, nº de série, ano,
   fabricante, modelo, tensão, corrente, frequência, carcaça, IP, fator de serviço) →
6. Vezes rebobinado → 7. Fotos adicionais (com nome) → 8. Resumo e confirmação →
   **gravação**.

Na gravação, cria a estrutura `Cadastro de Motores › Cliente › Motor` e salva:

- `Placa do motor antigo.jpg`
- `Motor antigo instalado.jpg`
- As fotos adicionais com os nomes informados
- `dados.txt` (texto puro, no formato padronizado; campos sem dado ficam como `N/D`)

Regras importantes já embutidas:

- **A IA nunca inventa dados.** O que estiver ilegível é marcado e pedido manualmente.
- **Conversão kW → CV** automática (CV = kW ÷ 0,7355), registrando os dois valores.
- **Fotos grandes são comprimidas/redimensionadas** antes do upload.
- Se já existir uma pasta com o nome do motor, o app pergunta se é **atualização** ou cria uma
  nova pasta com **sufixo de data**.

## 🚀 Como rodar

```bash
npm install          # também gera os ícones do PWA
cp .env.example .env  # opcional: preencha as chaves
npm start
```

Abra **http://localhost:3000** (no celular, use o IP da máquina). No celular, dá para
**instalar na tela inicial** (PWA) e usar a câmera direto.

## 🔑 Configuração das integrações (opcional)

### Leitura da placa por IA (Google Gemini)

1. Gere uma chave em <https://aistudio.google.com/apikey>.
2. No `.env`:
   ```
   GEMINI_API_KEY=sua_chave
   GEMINI_MODEL=gemini-2.5-flash   # ou gemini-2.5-pro para máxima precisão
   ```

### Google Drive (OAuth)

1. No [Google Cloud Console](https://console.cloud.google.com/): crie um projeto, ative a
   **Google Drive API** e crie uma credencial **OAuth 2.0 (Aplicativo Web)**.
2. Em *URIs de redirecionamento autorizados*, adicione:
   `http://localhost:3000/auth/google/callback`
3. No `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
   ```
4. Inicie o app e clique em **Conectar Google Drive** na tela inicial. O token fica salvo em
   `storage/google-token.json` (e você pode copiá-lo para `GOOGLE_REFRESH_TOKEN`).

> Sem o Drive configurado, tudo é salvo em `storage/Cadastro de Motores/...` e disponibilizado
> como ZIP — você pode arrastar a pasta para o Drive depois.

## 🧱 Arquitetura

```
server/                Node.js + Express (API)
  index.js             rotas: /api/config, /api/plate/read, /api/motor/{check,save}, /api/download, /auth/google
  config.js            variáveis de ambiente
  services/
    gemini.js          leitura da placa (Google Gemini) + conversão kW→CV
    googleDrive.js     OAuth + estrutura de pastas + upload (dados.txt como text/plain)
    localStore.js      fallback: salva local + gera ZIP
    image.js           compressão/redimensionamento (sharp)
    dadosTxt.js        gera o dados.txt no formato padronizado
public/                PWA (HTML/CSS/JS puro), manifest e service worker
scripts/generate-icons.js   gera os ícones do PWA
```

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `ROOT_FOLDER_NAME` | `Cadastro de Motores` | Pasta raiz |
| `GEMINI_API_KEY` | — | Liga a leitura por IA |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo Gemini |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | OAuth do Drive |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/auth/google/callback` | Callback OAuth |
| `GOOGLE_REFRESH_TOKEN` | — | Evita reautenticar |
| `GOOGLE_PARENT_FOLDER_ID` | — | Onde criar a raiz (vazio = Meu Drive) |
| `MAX_IMAGE_DIMENSION` | `2000` | Maior lado das fotos (px) |
| `IMAGE_QUALITY` | `82` | Qualidade JPEG |

## 📄 Formato do `dados.txt`

```
CLIENTE:
MOTOR:
DATA DO CADASTRO:
FABRICANTE / MODELO:
ROTAÇÃO (RPM):
POTÊNCIA (CV):
RENDIMENTO (%):
NÚMERO DE SÉRIE:
ANO DE FABRICAÇÃO:
VEZES REBOBINADO:
TENSÃO (V):
CORRENTE (A):
FREQUÊNCIA (Hz):
CARCAÇA:
GRAU DE PROTEÇÃO (IP):
FATOR DE SERVIÇO:
FOTOS ADICIONAIS:
OBSERVAÇÕES:
```
