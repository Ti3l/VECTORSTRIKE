# VECTOR STRIKE — Notas da atualização 1.1.0

## Implementado

- **Dispersão de tiros validada no servidor.** Mais precisão parado, menos ao andar/correr, bônus ao agachar e aumento de dispersão em rajadas.
- **Recuo e sensação de arma.** Reação imediata de câmera/arma ao atirar, animação de troca de arma, inspeção simples com `F`, efeito visual de impactos e mira dinâmica que abre conforme a dispersão.
- **Objetivo mais tático.** Bomba cai no chão quando o portador é eliminado ou desconecta. Atacantes próximos podem manter `E` por 0,5 segundo para recuperar. Bomba aparece como objeto 3D e, para atacantes, no minimapa quando perdida.
- **Espectador por equipe.** Quando você morre, acompanha um aliado vivo em primeira pessoa. Troque com ← e →; a visão não muda para jogadores inimigos.
- **Sons e feedback.** Passos sintéticos locais, avisos sonoros de bomba plantada, efeitos de dano e marcador de impacto, além dos sons básicos que já existiam.
- **Ajustes do jogador.** Menu de ESC com sensibilidade, volume, cor da mira, qualidade de renderização e opção de FPS. Preferências locais no navegador.
- **Rede.** Indicador de ping de aplicação (medição pelo cliente) e interpolação visual simplificada dos personagens.
- **Interface.** Versão 1.1 no menu, informações de espectador e HUD com dados do aliado observado.

## Como atualizar no Windows

1. Extraia o ZIP da V1.1 em **uma pasta nova**, sem mesclar com V1.
2. Abra o terminal na pasta `vector-strike-v1-1` que contém `package.json`.
3. Execute `npm install` e depois `npm run dev`.
4. Abra `http://localhost:5173`.
5. Crie uma sala e entre pelo mesmo código usando outro navegador ou janela anônima para iniciar um round.

As salas antigas e o placar não migram: o servidor mantém essas informações em memória. Seu codinome e configurações são lembrados no navegador.

## Limitações conhecidas

- Não há implementação completa de previsão/reconciliação de rede, lag compensation, sistema de contas, ranked, loja ou proteção anticheat avançada.
- O espectador usa snapshots recebidos do servidor e suavização simples; sob latência alta pode oscilar.
- O modelo de armas e animações ainda é geométrico/prototipado; os sons são gerados por código.
- A prévia desta entrega foi verificada por testes de regras e sintaxe. **Não foi possível baixar dependências no ambiente de geração**, portanto a compilação do Vite e uma partida real de dois clientes precisam ser confirmadas no seu computador.

## Como validar

- `npm run check`: sintaxe JavaScript do cliente e servidor.
- `npm test`: dez testes unitários de geometria, precisão e recuperação de bomba.
- `npm run build`: compila a versão de produção (depois do `npm install`).
- Faça um teste real com dois jogadores: atire parado/correndo, elimine o portador, recupere a bomba, plante/desarme, veja o modo espectador e altere as opções no ESC.
