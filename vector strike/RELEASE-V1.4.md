# VECTOR STRIKE V1.4 — Notas da versão

## Novo
- Sala exclusiva de treino contra 1 a 4 bots, sem exigir outro jogador.
- Dificuldade fácil, normal ou difícil: altera deslocamento, tempo de reação, dispersão e cadência.
- Bots renderizados com os mesmos modelos de personagem/arma, com nome BOT no placar.
- Navegação do servidor por caminhos válidos do mapa, sem atravessar caixas.
- Bots podem perseguir, disparar, recarregar e tentar desarmar a bomba.
- Botões para começar a rodada antes do cronômetro e reiniciar treino; atalho K.
- ¤ 9.000 no início de cada round de treino, sem alterar a economia das salas normais.
- Bots visíveis no minimapa durante o treino, para facilitar os testes.
- Salas de treino isoladas: um humano e 1–4 bots; fechadas ao desconectar.

## Mantido da V1.3.3
- Modelos GLB e posição lateral/diagonal das armas inspiradas em FPS tático.
- Loja, tipos de mira, rounds com bomba, simulação de disparo, proteção e multiplayer via WebSocket.
- Scripts Windows para iniciar servidor e Vite sem problemas com espaços no caminho.

## Verificações
- 47 testes automatizados passaram (`npm test`).
- Sintaxe conferida (`npm run check`).
- Testes de navegação, visão através de coberturas, tempo de reação e interação com a bomba.
- Não foi possível executar o navegador e o servidor juntos neste ambiente sem as dependências npm; valide o visual e o comportamento real no Windows.
