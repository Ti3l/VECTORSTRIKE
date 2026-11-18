# VECTOR STRIKE V1.8.1 — Multiplayer acessivel pela internet

- Novo `JOGAR-ONLINE-WINDOWS.bat` para compartilhar um link HTTPS temporario usando Cloudflare Quick Tunnel.
- Novo `tools/online.mjs` compila o Vite, inicia servidor Node e WebSocket no mesmo host/porta e acompanha a vida do tunel.
- Servidor aceita variavel de ambiente `HOST`; no tunel usa `127.0.0.1` por seguranca e, em hospedagens remotas, por padrao continua `0.0.0.0`.
- Content types expandidos para GLB/FBX e cache HTML desativado, para evitar versao antiga apos publicar.
- `render.yaml` e instrucoes de deploy para URL permanente, caso desejado.
- Jogabilidade, mapa, bots, loja, armas, lobby e fisica da V1.8 preservados.

Nao representa servidor global implantado automaticamente. Para jogar fora da rede, deve instalar cloudflared e manter o jogo e o tunel abertos, ou hospedar no Render.
