# V1.7 — NOVO MAPA: COMPLEXO ÍRIS

Atualização construída sobre a V1.6, mantendo o lobby e toda a lógica de multiplayer.

| Recurso | V1.6 | V1.7 |
|---|---|---|
| Área do campo | 46 × 36 | 80 × 62 |
| Bomba | 1 site | **2 sites, A e B** |
| Layout | pátio pequeno | três rotas com meio e flancos |
| Coberturas | 10 | **24** |
| Arte de cenário | blocos geométricos | blocos + **13 modelos FBX** e atlas original |
| Minimap | site A | sites A e B; escala revisada |
| Bots | navmesh pequena | rotas recalculadas para o campo maior |

**Instale em pasta nova.** Execute `INICIAR-WINDOWS.bat`, abra `http://localhost:5173` e teste ambos os locais de plantio. A classe de mapa no cliente usa `FBXLoader`, do pacote `three/addons`, para renderizar os arquivos em `public/map/fps-lite/`.

**Teste recomendado:** criar sala com bots, comprar um rifle, avançar pela rota A, plantar, reiniciar treino com K, tentar rota B e verificar no minimapa a bomba e os dois sites. Quando o carregamento FBX falhar, permanece um bloco geométrico no lugar.

**Verificações executadas:** testes `node --test` e `node --check`. **Pendente:** instalação das dependências, build Vite e teste visual completo com FBX em browser; o ambiente de criação não conseguiu obter o pacote `three` do npm.
