# Notas da atualização V1.2

## Visão geral

Arsenal e compra tática por round, com moeda própria (¤), preços e valores originais, reembolso da fase atual, economia preservada entre rounds, seis armas distintas, coletes, ADS e modelos 3D procedurais.

## Migração da V1.1

A V1.2 inclui alterações **no cliente e no servidor**. Não basta substituir só `index.html` ou `src/main.js`.

1. Extraia o ZIP em pasta separada.
2. Execute `npm install` e `npm run dev` nela.
3. Não mantenha a V1.1 rodando simultaneamente nas portas 5173/3001.
4. Reúna duas pessoas na mesma sala e valide: fase de compra, opções por créditos, reembolso, compra fora da fase, disparos, colete, mortes, próximo round e persistência.

## O que testar primeiro

1. Criar sala com dois jogadores; a fase de compra deve abrir automaticamente, durante 20 segundos.
2. Comprar Hammer .50 por ¤ 500 e reembolsá-la; o saldo volta a ¤ 800.
3. Comprar colete leve (¤ 400), fechar a loja com B, esperar começar; a compra fica bloqueada.
4. Eliminar um jogador ou encerrar o round. O dinheiro aumenta conforme o resultado.
5. Próximo round: jogador vivo conserva armas/colete; eliminado volta com pistola inicial.
6. Comprar rifle, testar troca de 1/2, precisão parado, movimentação, ADS e R para recarregar.

## Itens fora do escopo da V1.2

Loja de habilidades, entrega de arma a companheiros, skins cosméticas, espectador livre, matchmaking, persistência em banco e animações esqueléticas são ideias para versões futuras.
