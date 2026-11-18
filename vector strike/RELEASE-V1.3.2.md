# VECTOR STRIKE V1.3.2 — Mira tática inspirada no VALORANT

## Corrigido

- **Pistolas (P320, P226, SR1MP e revólveres)**: sempre ficam mais para a direita e para baixo. Botão direito não centraliza nem amplia a pistola, como nas sidearms sem ADS do VALORANT.
- **Rifles e SMGs**: botão direito ativa uma transição suave com leve zoom (FOV 76 → 68), arma um pouco abaixo do retículo, sem ocupar excessivamente o centro.
- **Snipers/DMRs de precisão (SRSA1, Chassis e M21)**: botão direito ativa uma luneta circular com zoom, escurecendo a área externa. A arma deixa de obstruir a visão enquanto a luneta está ativa.
- **Escopeta e RPG**: sem aproximação de mira para evitar desalinhamentos e uso impróprio do ADS.
- A dispersão no cliente só solicita o bônus de ADS ao servidor em armas que realmente possuem modo de mira.
- Todos os 14 modelos GLB, a economia, o multiplayer e a loja foram preservados.

## Instalação no Windows

1. Extraia o ZIP numa pasta nova chamada `vector-strike-v1-3-2`.
2. Entre na pasta `vector-strike-v1-3-2` e abra `INICIAR-WINDOWS.bat`.
3. Caso prefira o terminal, execute `npm install` e `npm run dev`.
4. Acesse `http://localhost:5173`.
5. Entre numa sala e teste segurando o botão direito com P320, MDR e SRSA1.

## Verificações

- `npm test`: 39 testes passaram, incluindo todas as classes de armas.
- `npm run check`: arquivos JavaScript passaram na análise de sintaxe.
- A visualização real com WebGL e o multiplayer ainda precisam de validação no navegador após instalar as dependências.

**Observação:** comportamento inspirado no VALORANT, com visuais próprios do VECTOR STRIKE. A pistola inicial ainda não tem ataque alternativo de rajada no botão direito.
