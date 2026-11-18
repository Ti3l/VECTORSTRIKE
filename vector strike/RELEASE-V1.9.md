# VECTOR STRIKE V1.9 — Publicação Vercel

## Atualizado
- `vercel.json`: projeto Vite estático com saída `dist` e cache de assets versionados.
- `src/ws-endpoint.js`: define WS/WSS via `VITE_WS_URL` ou origem local para desenvolvimento/tunnel.
- Aviso útil no lobby se o site estiver na Vercel sem backend configurado.
- `server/index.js`: validação opcional de domínio no upgrade WebSocket via `ALLOWED_ORIGINS`.
- `render.yaml`: backend Node/WebSocket separado, sem compilar Vite.
- `tools/check-deploy.mjs`: diagnóstico HTTP e WebSocket após publicação.
- Guia `DEPLOY-VERCEL.md` com passo a passo e limitações.

## Não mudou
Lobby, armas 3D, economia, bots, mapa, pulo e lojas continuam iguais à V1.8.2.

## Limitações
Servidor em memória requer uma instância e não se restaura após reinício.
Plano gratuito Render não tem região São Paulo e pode dormir por inatividade.
A compilação Vite deve ser confirmada no Windows/Vercel; o ambiente de criação
não alcançou o registro npm. Testes de código e sintaxe passaram.
