# VECTOR STRIKE V1.9 — Vercel e multiplayer permanente

**Esta versão prepara o VECTOR STRIKE para deploy na Vercel**, sem remover o lobby,
o campo de treino com bots, a loja, a economia, as armas e o Complexo Íris.
O frontend é publicado na Vercel e o backend WebSocket deve ficar em um serviço
Node.js (o arquivo `render.yaml` facilita usar Render para testes).

**COMECE POR AQUI:** [`DEPLOY-VERCEL.md`](./DEPLOY-VERCEL.md).

- Desenvolvimento local: `npm install` e `npm run dev` → `http://localhost:5173`.
- Publicação frontend: `npm run build` → `dist/`.
- Backend: `npm start` (`PORT` configurável, WebSocket `/ws`).
- Vercel: variável `VITE_WS_URL=wss://SEU-SERVIDOR/ws`.
- Render: variável opcional `ALLOWED_ORIGINS=https://SEU-PROJETO.vercel.app`.
- Testes: `npm test` e `npm run check`.

## Histórico de desenvolvimento

# VECTOR STRIKE V1.8.2 — Complexo Íris + link online para amigos

FPS tático 3D multiplayer para navegador. Esta versão aprimora o cenário da V1.7 para o **COMPLEXO ÍRIS**, com aproximadamente **80 × 62 unidades**, três rotas (norte, meio e sul), dois locais de bomba (A e B), pontos de cobertura, sinalização e peças **FBX do pacote FPS_Lite_FBX.zip fornecido pelo usuário**.

## Jogar online com um amigo de outra casa (NOVO V1.8.2)

`localhost:5173` **nao e um endereco publico**. Para compartilhar o jogo completo, instale `cloudflared` uma vez com `winget install -e --id Cloudflare.cloudflared`, abra `JOGAR-ONLINE-WINDOWS.bat` e compartilhe a URL `https://...trycloudflare.com` exibida. Ambos devem acessar essa mesma URL e a janela do servidor deve continuar aberta. O modo online serve o build e as conexoes WebSocket na mesma origem. Veja **JOGAR-ONLINE-LEIA-ME.md**.

## Instalação (Windows)

1. Extraia **VECTOR-STRIKE-V1.8-CHAO-PULO-CASAS-ABERTAS.zip** em **uma pasta nova**.
2. Entre na pasta `vector-strike-v1-8` e abra `INICIAR-WINDOWS.bat`.
3. Aguarde o terminal iniciar os dois processos e abra **http://localhost:5173**.

Ou pelo terminal:

```powershell
npm install
npm run dev
```

Requer Node.js 22.12+ e navegador com WebGL. Não misture os arquivos desta versão com os da V1.7. Se o navegador mostrar a versão antiga, feche os servidores antigos, recarregue a página e confira **ALPHA 1.8** no topo.

## Novidades da V1.8

- **Textura de chão revisada:** concreto industrial gerado em CanvasTexture com repetição, manchas, granulação, rachaduras discretas e juntas, além de faixas asfaltadas em três rotas.
- **Pular:** pressione **Espaço** durante o jogo; gravidade e aterrissagem calculadas no cliente e validadas pelo servidor. Segurar Espaço não gera pulos ilimitados.
- **Escalar caixas:** posicione-se próximo à caixa, salte e se mova para cima dela; as mais altas exigem usar primeiro uma caixa de apoio. É possível cair das plataformas normalmente.
- **6 construções abertas:** Oficinas, depósitos e passagens com portas reais, teto, iluminação e coberturas internas; não são mais blocos maciços. Os tiros reconhecem as paredes e o teto.
- **Bots e rede:** navegação recalculada após os vãos de porta; posição vertical dos jogadores sincronizada e altura de headshots atualizada.

**Como testar:** Lobby → Campo de treino com bots → inicie o round. Use WASD para caminhar, Espaço para pular e Shift para correr. Teste os degraus de caixas na rota norte, entre nos depósitos A/B, e veja a altura dos demais jogadores.

## Novidades do mapa

- **Arena 80 × 62**: consideravelmente maior que a anterior (46 × 36).
- **Rotas de ataque**: norte (Site A), meio (possibilidade de flanco) e sul (Site B); caminhos conectados por corredores.
- **Sites A e B funcionais**: o portador pode plantar a bomba em qualquer um; o servidor identifica o site, controla o tempo de plantio e a bomba é mostrada no minimapa.
- **Coberturas baixas e altas, paredes de construções e telhados** validados pelo servidor. Movimento, bots e tiros reconhecem as mesmas coberturas.
- **13 modelos `.fbx` + atlas de textura** copiados do pacote enviado, em `public/map/fps-lite/`: paredes, escadas decorativas, caixas, tábuas, jarros e tijolos; os prédios abertos usam paredes modulares próprias para permitir entradas reais.
- **Carregamento progressivo**: o mapa aparece imediatamente com blocos geométricos; quando os FBX terminam de carregar, substituem as coberturas visuais. Caso um modelo falhe, o bloco continua no lugar.
- **Minimapa atualizado**: escala correta para o novo campo e indicação dos dois sites.
- **Bots atualizados**: a malha de navegação se adapta ao tamanho e respeita as novas coberturas.
- Sinalização e diferenciação das áreas com iluminação quente para A e ciano para B.

### Limitações do protótipo

- O **pulo e a aterrissagem em caixas e telhados acessíveis** funcionam; as escadas FBX continuam decorativas, sem subida automática por degraus. O edifício possui piso térreo acessível, não um segundo andar interior.
- As caixas de colisão são retangulares, mesmo que o modelo FBX tenha um recorte, para manter cliente/servidor/bots sincronizados. O modelo pode ser ligeiramente diferente do colisor em alguns detalhes.
- **Não foi possível executar aqui o build completo do navegador**, porque o ambiente não conseguiu instalar as dependências npm. Os testes de Node e a checagem de sintaxe foram executados; a verificação final visual de FBX e multiplayer deve ser feita no seu PC.
- O arquivo enviado **não inclui evidência de licença de redistribuição/comercialização**. Confirme os termos da origem antes de publicar um projeto comercial.

## Sistemas preservados

Lobby com 6 vagas, convites e pronto; partidas multiplayer, treino com bots (1 a 4), loja e créditos, 14 modelos `.glb` de armas, mira lateral, HUD, dano, bomba e placar.

## Controles

- `WASD` movimento, `Shift` correr, `Ctrl/C` agachar.
- Mouse para mirar, clique esquerdo atirar; botão direito para zoom (onde suportado).
- `B` compra, `1/2` troca de armas, `R` recarrega.
- `E` para plantar no **Site A ou B**, recuperar ou desarmar a bomba.
- `Tab` placar, `K` reiniciar treino com bots.

## Validação local

```powershell
npm test
npm run check
npm run build
```

A última ação depende da instalação do Vite. Para jogar com amigos fora do seu PC, é preciso publicar também o servidor Node/WebSocket (a porta local é 3001 e o Vite usa 5173).

Veja `RELEASE-V1.8.md` (e `RELEASE-V1.7.md` para o mapa original) para um resumo da atualização e `RELEASE-V1.6.md` para as mudanças no lobby.


## V1.8.2 — estabilidade da conexão

Veja `OTIMIZAR-CONEXAO-LEIA-ME.md` para comparar ping, variacao e testar acesso direto local / link publico.
