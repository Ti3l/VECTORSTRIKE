# VECTOR STRIKE V1.3.3 — Posicionamento das armas inspirado no VALORANT

## Alterações

- **Pistolas:** empunhadura menor visualmente, mais à direita e abaixo; cano visto de lado, na diagonal para o centro. Sem ADS nas pistolas.
- **Fuzis e SMGs:** novas poses específicas; a arma aponta da parte inferior direita para o centro e continua lateral ao mirar com botão direito, sem cruzar o retículo.
- **Snipers e DMRs:** corpo e luneta aparecem à direita durante a movimentação; o modo de luneta continua cobrindo a visão ao mirar.
- **Escopeta, revólveres e RPG:** poses adequadas ao tamanho de cada tipo de arma.
- **Mãos e antebraços provisórios:** nova empunhadura low-poly acompanhando as armas, pronta para substituição por animações 3D reais.
- Mantidos os 14 modelos `.glb`, a loja, a economia, as salas multiplayer e os cálculos de dano do servidor.

## Instalação Windows

1. Extraia este ZIP em uma **pasta nova** `vector-strike-v1-3-3`, mantendo a versão anterior como backup.
2. Entre na pasta e abra `INICIAR-WINDOWS.bat` ou rode `npm install` e depois `npm run dev`.
3. Abra `http://localhost:5173` no navegador.
4. Teste a P320 sem botão direito, o MDR com e sem botão direito e o SRSA1 com a luneta.
5. Se a imagem antiga persistir, pare o servidor anterior e atualize a página com `Ctrl+F5`.

## Observações

Ajustes testados por código e testes automatizados; enquadramento final deve ser conferido no navegador (FOV e proporção da tela afetam a aparência). Nenhuma imagem gerada foi usada no jogo. Os arquivos `.glb` vieram do pacote fornecido pelo usuário; verificar a licença antes de publicar ou monetizar.

A conferência geométrica aproximada dos modelos P320, MDR e SRSA1 em uma tela 16:9 posicionou seus limites à direita do centro (aprox. 59%–87% da largura), sem invadir o retículo central. Isso não substitui a validação visual no navegador.
