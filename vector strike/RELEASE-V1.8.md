# VECTOR STRIKE V1.8 — CHÃO, PULO E CONSTRUÇÕES ABERTAS

Construído sobre a V1.7 (Complexo Íris), preservando lobby em tela cheia, convites, sala de treino com bots, partidas 3v3, loja, economia, 14 armas GLB, dois sites e os assets FBX.

## Implementado

1. Chão de concreto mais detalhado e pavimentos com textura procedural repetida, sem imagens adicionais. Para evitar manchas repetidas ou estiramento, a textura é gerada uma vez e mapeada com `RepeatWrapping`.
2. Pulo com barra de espaço, gravidade, queda, aterrissagem em caixas e em telhados altos alcançáveis a partir das coberturas. A física de posicionamento é compartilhada e conferida pelo servidor, não apenas uma animação da câmera.
3. Caixas de apoio posicionadas junto a coberturas maiores para criar níveis de subida por saltos.
4. Seis interiores (oficinas, depósitos e passagens) com portas abertas, paredes em colisores modulares, iluminação e pequenas coberturas internas. O jogador pode atravessar os ambientes.
5. Tiros e detecção de headshot consideram a altura do alvo. A posição vertical de outros jogadores aparece sincronizada. Telhados e paredes bloqueiam tiros.
6. Caminhos de bots preservados até os dois sites; entradas das seis construções verificadas pela malha de navegação.

## Teclas

- WASD mover; Espaço pular; Shift correr; Ctrl/C agachar; B loja; E plantar/desarmar; R recarregar.

## Limitações e testes

- O protótipo ainda usa colisões retangulares simplificadas e não anima o salto dos braços/pernas dos personagens. Os FBX do pacote continuam sendo elementos estáticos.
- Testes de lógica e sintaxe podem ser executados com `npm test` e `npm run check`.
- O ambiente de desenvolvimento desta atualização não conseguiu acessar `registry.npmjs.org` (`EAI_AGAIN`), portanto **o build Vite e a partida completa em navegadores não foram verificados aqui**. Teste no Windows abrindo `INICIAR-WINDOWS.bat`.
