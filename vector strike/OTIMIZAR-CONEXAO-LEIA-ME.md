# VECTOR STRIKE V1.8.2 — Estabilidade de rede

## O que esta nova versao modifica
- Snapshots do servidor passam de aproximadamente 10 para 20 por segundo, com menor espera entre movimentos.
- Em conexoes congestionadas, o servidor **descarta apenas snapshots de estado que ja ficaram antigos** quando ha mais de 192 KB aguardando envio. Eventos e compras continuam no canal normal.
- Indicadores do HUD mostram PING (mediana das ultimas 7 medidas de ida e volta) e VAR (variacao media entre medidas): variacao alta indica instabilidade.
- Comandos de movimento sao transmitidos a cada ~40ms no lugar de 48ms.
- Mesmo site, lobby, mapa, armas, bots e economia da V1.8.1.

## Teste com sua amiga
1. Extraia este ZIP em uma pasta nova, instale o cloudflared e execute **JOGAR-ONLINE-WINDOWS.bat**.
2. Voce abre **http://localhost:3001** no computador que esta hospedando a partida.
3. Sua amiga abre o link HTTPS `*.trycloudflare.com` exibido no terminal. Ambos acessam o **mesmo servidor**.
4. Comparem PING e VAR no HUD. Para comparar corretamente, testem mais de 15 segundos de partida sem downloads ativos.
5. Se a amiga permanecer acima de ~150–200ms ou se VAR subir muito, experimentem uma hospedagem de jogo perto dela e de voce (por exemplo, VPS em Sao Paulo para jogadores no Brasil).

## Limite importante
PING e medido pelo cliente como ida e volta WebSocket; ele **nao e o tempo de renderizacao**. Alterar a taxa de snapshots torna o jogo mais fluido, mas **nao elimina RTT real, perda de pacotes ou trajetos longos do provedor/tunel**. Cloudflare Quick Tunnels sao destinados a teste, nao a hosting competitivo.

O arquivo `render.yaml` continua sendo uma opcao de hospedagem, mas antes de escolher um provedor confirme onde o backend realmente roda. Um servidor em outro continente pode aumentar o ping.
