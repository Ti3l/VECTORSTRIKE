# VECTOR STRIKE V1.9 — Publicar na Vercel (site) + Render (multiplayer)

Esta versão é a **V1.8.2 com configuração de hospedagem**, não uma reescrita do jogo.
**Não basta publicar somente o site.** O lobby, os bots, as partidas e os tiros precisam
executar no mesmo processo Node.js com WebSockets.

## Arquitetura

- **Vercel:** site estático (Vite + Three.js), modelos GLB/FBX, CSS e interface.
- **Render Web Service (ou outro host Node.js):** processo `server/index.js`,
  porta definida por `PORT` e WebSocket no caminho `/ws`.
- **VITE_WS_URL:** variável da Vercel que aponta para o servidor multiplayer.

O front e o servidor terão endereços diferentes, mas compartilham as mesmas salas
por estarem conectados ao mesmo processo backend. Na versão atual, as salas ficam
em memória: reiniciar o backend encerra partidas e apaga lobbies.

### 1) Enviar o código para o GitHub

1. Crie um repositório privado (ou público se confirmar as licenças dos assets).
2. Envie o **CONTEÚDO** da pasta `vector-strike-v1-9-vercel` para a raiz do repositório.
   É importante que `package.json`, `vercel.json`, `render.yaml`, `src/`, `server/`
   e `public/` estejam juntos na raiz.
3. Não inclua `node_modules/`, `dist/` ou `.env`.
4. Confirme as licenças dos pacotes FBX/GLB antes de publicar os assets em URL pública.

### 2) Publicar PRIMEIRO o servidor multiplayer no Render

1. Entre em https://dashboard.render.com e conecte seu repositório GitHub.
2. Escolha **New > Blueprint** para usar `render.yaml`, ou crie **Web Service** manualmente.
3. No modo manual, configure:
   - Runtime: **Node**
   - Region: **Virginia** (exemplo; Render não oferece região São Paulo)
   - Build Command: `npm install --omit=dev --no-audit --no-fund`
   - Start Command: `npm start`
   - Health Check: `/health`
   - Environment: `NODE_VERSION=22.12.0`, `NODE_ENV=production`
   - Plano Free para teste (pode dormir depois de inatividade).
4. Espere o deploy finalizar. Copie o domínio real do serviço, por exemplo:
   `https://vector-strike-multiplayer.onrender.com` (EXEMPLO, não é um link seu).
5. Acesse `https://SEU-BACKEND.onrender.com/health`.
   Deve mostrar algo como `{"ok":true,"rooms":0}`.

**ATENÇÃO:** Render no plano Free pode suspender o serviço após 15 minutos de
inatividade, reiniciar ou demorar na primeira conexão. Não é adequado para um
jogo competitivo definitivo. Para menor latência no Brasil, prefira depois um
servidor Node.js numa região brasileira (o código não depende da Render).

### 3) Publicar o site na Vercel

1. Entre em https://vercel.com/new, importe **o mesmo repositório**.
2. Framework Preset: **Vite**; Root Directory: a pasta que contém `package.json`.
3. Build Command: `npm run build`; Output Directory: `dist`.
4. **Antes do Deploy**, adicione a variável de ambiente:

   `VITE_WS_URL = wss://SEU-BACKEND.onrender.com/ws`

   Alternativamente use `https://SEU-BACKEND.onrender.com` (o cliente converte para
   `wss://` e acrescenta `/ws`). Não coloque `localhost`, barra extra nem aspas.
   A variável **VITE_** é pública: nunca coloque senhas nela.
5. Clique em Deploy. O resultado será um link como `https://seu-projeto.vercel.app`.
6. Se alterar `VITE_WS_URL` depois, faça um **Redeploy**: o Vite a incorpora no build.

### 4) Restringir conexões ao seu domínio (recomendado)

Depois de conhecer o domínio final da Vercel, no painel do Render defina:

`ALLOWED_ORIGINS=https://seu-projeto.vercel.app`

Se houver domínio próprio, separe por vírgulas: `https://seu-projeto.vercel.app,https://jogo.seudominio.com`.
Sem essa variável, o servidor aceita origens de qualquer site. Com a variável,
conexões fora da lista são rejeitadas (HTTP 403). Coloque a origem **sem barra final**.
Se fizer testes por Preview URL da Vercel, inclua também o domínio exato dela.
Reinicie/republique o servidor após alterar a variável.

### 5) Verificar o servidor antes de convidar amigos

No seu computador (na pasta do projeto, com dependências instaladas):

```powershell
npm run deploy:check -- https://SEU-BACKEND.onrender.com https://SEU-PROJETO.vercel.app
```

O teste verifica `/health` e faz um handshake WebSocket de lobby. Depois abra
**o link da Vercel em dois computadores**, use o lobby social, convide sua amiga,
marquem PRONTO e iniciem a partida. Todos precisam estar na mesma versão publicada.

### Problemas comuns

- **O site abre, mas o lobby não:** confira `VITE_WS_URL` no ambiente Production da Vercel,
  confirme o URL real do backend e faça Redeploy na Vercel.
- **HTTP 403 no WebSocket:** a origem de acesso não está em `ALLOWED_ORIGINS`.
- **Página em branco:** verifique o build Vite e assets `public/models/` e `public/map/`.
- **Primeira conexão lenta:** serviço gratuito em cold start. Tente novamente após o serviço iniciar.
- **MS ainda alto:** publicar o site na Vercel não diminui automaticamente o ping;
  a localização do **backend** é o fator decisivo. Render tem Virginia, mas não São Paulo.
- **Amigos em casas diferentes:** use o endereço HTTPS da Vercel, NUNCA `localhost`.
- **Local/testing:** `npm run dev` continua funcionando via proxy `/ws` do Vite.
- **Modo Tunnel anterior:** `JOGAR-ONLINE-WINDOWS.bat` continua disponível para testes
  separados, desde que não defina `VITE_WS_URL` apontando para um backend público.

## Limites atuais

Não há contas persistentes, recuperação automática de partida nem persistência de
salas. O servidor deve rodar **em uma instância**; aumentar para várias instâncias
sem Redis/coordenação dividiria os jogadores em lobbies diferentes. Também não há
proteção anti-DDoS/anti-cheat de produção. Para um beta público, implemente
limitação de taxa por IP/sessão, autenticação, métricas e armazenamento persistente.

Embora a Vercel agora suporte WebSockets em Functions, cada conexão fica presa a
uma instância por tempo limitado; o VECTOR STRIKE guarda sala/players em memória.
Migrar todo o motor para Functions exigiria coordenação (ex. Redis) e refazer o loop.
Separar frontend e backend evita essa mudança agora.
