# VECTOR STRIKE V1.8.2 — JOGAR ONLINE COM AMIGOS

**O endereco `localhost:5173` funciona apenas no computador onde o jogo esta aberto.** Esta atualizacao oferece um modo para compartilhar um link HTTPS temporario, com **site + servidor multiplayer WebSocket** no mesmo endereco.

## Passo a passo no Windows (outra casa / outra rede)

1. Extraia o ZIP desta versao para uma pasta nova.
2. Instale o **Node.js 22.12+** (se ja tiver, nao precisa reinstalar).
3. Instale o `cloudflared` da Cloudflare **uma unica vez**, abrindo PowerShell e executando:

   ```powershell
   winget install -e --id Cloudflare.cloudflared
   ```

   Se `winget` nao estiver disponivel, siga a documentacao oficial em https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
4. **Feche o terminal e abra novamente**, para reconhecer o novo programa.
5. Execute **`JOGAR-ONLINE-WINDOWS.bat`**. Ele compila o jogo, liga o Node do multiplayer e cria o tunel.
6. Aguarde aparecer no terminal uma URL parecida com `https://palavras-aleatorias.trycloudflare.com` (o endereco e aleatorio; nao copie este exemplo).
7. Envie **essa URL exata** para sua amiga. No PC que esta hospedando, use **http://localhost:3001** para evitar a volta pelo tunel. Use o lobby para se convidarem, marcar Pronto e iniciar.
8. **Mantenha a janela aberta**, com PC conectado a internet. Fechar a janela ou desligar o PC encerra o acesso; um novo inicio pode gerar outro link.

O botao `INICIAR-WINDOWS.bat` continua iniciando o **modo local/desenvolvimento** (`http://localhost:5173`) para voce trabalhar no jogo. Para convidar pessoas fora da sua rede, use **JOGAR-ONLINE-WINDOWS.bat**.

## Conferir se o servidor esta funcionando

Antes de enviar o link, abra no mesmo computador `http://localhost:3001/health`. Deve aparecer algo como `{"ok":true,"rooms":0}`. Acesse depois o link publico no seu proprio navegador e confirme se ele abre o jogo e conecta no lobby. O cliente usa `wss://<mesmo-host>/ws` automaticamente quando o link e HTTPS.

**Se a amiga abrir o jogo mas nao conectar no lobby:** confira se o terminal com o tunel continua aberto; reinicie o modo online e compartilhe a URL atual. Evite duas copias do jogo executando simultaneamente na porta 3001.

## Seguranca e limites

- **O link temporario e publico para qualquer pessoa que o possua.** Compartilhe apenas com pessoas de confianca. O prototipo ainda nao tem login autentico, anti-cheat ou sistema de moderacao.
- O Quick Tunnel e **para testes**, nao uma hospedagem profissional. Pode ter instabilidade e latencia adicional. Nao precisa abrir portas do roteador nem configurar IP publico para este modo.
- O projeto preserva modelos GLB e assets FBX enviados previamente; verifique as licencas antes de publicacao comercial.
- Algumas redes e antivirus podem bloquear o `cloudflared`. Se falhar, use a hospedagem permanente indicada abaixo.

## URL permanente (recomendado para jogar com amigos com frequencia)

A pasta tambem inclui `render.yaml`: e possivel subir o codigo para um repositorio Git e criar um **Web Service Node** na Render. Configure `npm install && npm run build` como build e `npm start` como start, preservando o WebSocket na mesma URL do frontend. Render oferece conexoes WebSocket e fornece a URL HTTPS do projeto.

**Observacao:** uma instancia gratuita pode hibernar por inatividade, e a memoria das salas e temporaria; para partidas consistentes, utilize uma instancia com tempo de atividade apropriado. A hospedagem nao foi criada automaticamente neste pacote.

Documentacao: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ e https://render.com/docs/websocket
