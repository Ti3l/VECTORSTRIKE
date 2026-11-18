# VECTOR STRIKE V1.6 — Lobby de equipe e identidade visual

## Entregue

- Layout centralizado de grupo, inspirado na estrutura de FPS táticos: seis cartões, líder, jogadores prontos e vagas para convidar.
- Cartões originais em HTML/CSS; não são capturas nem artes extraídas de VALORANT.
- Card do jogador, equipes, lobby social pesquisável, favoritos e link de convite.
- Área de ações com **Trocar time**, **Marcar pronto**, **Iniciar partida** e as mesmas regras servidoras da V1.5.
- Nova linguagem visual: Inter/Barlow Condensed com fontes substitutas, azul-petróleo/menta, coral para atacantes e azul para defensores.
- Ajustes de consistência no HUD, menu inicial, minimapa, placar, loja e pausa.
- Mantidos multiplayer, economia, 14 armas GLB, bomba, bots e controles.

## Testes

- `npm test`: 57 testes aprovados, incluindo 3 novos testes de cartões e integridade do HTML.
- `npm run check`: verificação de sintaxe aprovada.
- Inspeção visual isolada do lobby com Chromium para layout desktop; não confirma o fluxo de jogo ao vivo.
- `npm install` excedeu o tempo de acesso ao registro neste ambiente. Não foi possível concluir o build Vite nem testar uma partida multiusuário real aqui.

## Instalação

Extraia o pacote em pasta nova `vector-strike-v1-6`, execute `INICIAR-WINDOWS.bat` ou use `npm install` e `npm run dev` no terminal. Acesse `http://localhost:5173`.

## Limites

Codinomes temporários; sem contas permanentes, avatares configuráveis, matchmaking ou sistema de ranks. Todos os amigos devem entrar no mesmo servidor. Links não tornam `localhost` acessível pela Internet.
