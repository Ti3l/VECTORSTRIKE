# V1.5 — LOBBY DE GRUPO

**Objetivo:** eliminar a necessidade de inserir manualmente o código de sala para jogar com amigos e criar uma etapa de grupo antes de começar o jogo.

## Entregue

- Entrada no lobby com codinome e lista de jogadores online no servidor.
- Convites por nome, aceitar/recusar e expiração de 60 segundos.
- Grupo com até seis pessoas, equipes de até três, botão de troca de equipe, estados Pronto/Aguardando, líder e botão Iniciar bloqueado até cumprir os requisitos.
- Link de grupo para entrada por clique, sem copiar/digitar código manualmente.
- Favoritos de codinomes salvos localmente no navegador.
- Retorno do grupo ao lobby ao finalizar a partida; opção para o líder encerrar partida e voltar ao grupo e opção de saída individual para participantes.
- Migração de liderança quando líder desconecta ou sai do grupo.
- Separação entre salas sociais e as antigas salas privadas por código; visitantes não contornam convites com o comando antigo.
- Manutenção de bots de treino, mapa, arsenal GLB, economia, compra de armas, bomba e multiplayer existente.

## Arquivos principais

- `src/lobby.js`: regras de nomes, equipes, início de grupo e estado público.
- `server/index.js`: presença, convites, movimentação entre grupos, início e retorno.
- `src/main.js`, `src/style.css`, `index.html`: tela social, convites e ações do usuário.
- `server/lobby.test.js`: testes de regras de lobby.

## Escopo / testes

54 testes de lógica e verificação de sintaxe passaram. O servidor e a UI precisam de validação manual com conexões WebSocket reais; dependências npm não puderam ser instaladas neste ambiente. Contas persistentes, autenticação e lista de amigos verificados não estão incluídas nesta V1.5.
