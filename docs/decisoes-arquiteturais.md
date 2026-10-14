# Decisões arquiteturais do frontend

> Registro das decisões que moldaram o frontend, com o motivo e as alternativas
> descartadas. Segue o espírito do `backend/docs/arquitetura.md`: decisões que foram
> deliberadamente **não** tomadas também fazem parte do projeto.

---

## AD-F01 — Padrão BFF: o token nunca chega ao JavaScript

**Contexto.** O backend usa JWT Bearer stateless, TTL de 8h, sem refresh token e sem
revogação. O cliente precisa enviar `Authorization: Bearer` em toda requisição.

**Decisão.** O token vive num cookie `httpOnly`, gravado por uma rota do próprio Next
(`/api/bff/login`). Todo acesso do navegador à API passa por um proxy
(`/api/backend/[...caminho]`) que lê o cookie e injeta o cabeçalho no servidor.

**Por quê.** `localStorage` e cookie legível por script são lidos por qualquer XSS. O
risco não é hipotético neste domínio: materiais são URLs enviadas por outros usuários — o
backend restringe a `http/https` justamente por isso. Com `httpOnly`, um XSS não alcança a
sessão.

**Ganhos colaterais.** A URL interna do backend não vai para o bundle, e o CORS deixa de
existir para o navegador (mesma origem).

**Custo aceito.** Um salto de rede extra por requisição do cliente. Em troca, leituras
iniciais são feitas por Server Components, que falam com o Nest diretamente.

**Verificado.** No navegador, com sessão ativa: `document.cookie`, `localStorage` e
`sessionStorage` vazios.

---

## AD-F02 — Autorização em um módulo só, e declaradamente como UX

**Decisão.** Todas as regras de autorização visual ficam em
`lib/autorizacao/capacidades.ts`, traduzidas em booleanos nomeados
(`podeHabilitarMonitor`, `podeDeclararDisponibilidade`…). Nenhum componente compara papel
diretamente.

**Por quê.** As regras do domínio são **contextuais**: dependem do papel do usuário
*naquela* monitoria. Espalhadas em `if`s, uma mudança viraria uma caçada, e variantes
ligeiramente diferentes surgiriam em cada tela.

**Limite explícito.** Isto é UX, não segurança. Guards e constraints do backend continuam
valendo se este arquivo inteiro for adulterado no navegador. Um **403 na tela é sintoma de
divergência** entre este módulo e o servidor — vale investigar, não esconder.

**Alternativa descartada.** Uma biblioteca de RBAC (CASL e afins): há dois perfis, dois
papéis e escopo fixo. A indireção custaria mais do que resolve.

---

## AD-F03 — `redirect()` só em layout; páginas renderizam estado

**Contexto.** Um `redirect()` chamado dentro de uma **página** acontece depois que o
layout já começou a ser transmitido. O Next então não consegue mais responder 307 e cai
num `<meta http-equiv="refresh">` com 1 segundo de atraso — o usuário vê a tela restrita
aparecer e sumir.

**Decisão.** Redirecionamento só onde a decisão precede o primeiro flush: no layout
(`exigirSessao`). Em páginas, `verificarPerfil` + `<SemAcesso>`.

**Efeito colateral bom.** Dizer "esta área é restrita a professores" é mais honesto do que
devolver a pessoa ao painel sem explicação.

**Descoberto em teste**, não em revisão de código: a auditoria de autorização mostrou um
aluno recebendo 200 em `/disciplinas`.

---

## AD-F04 — Fuso da instituição vem do servidor, nunca do navegador

**Contexto.** O backend guarda atendimentos em `TIMESTAMPTZ`, mas a disponibilidade do
monitor é declarada em **hora local da instituição**, e a validação da janela roda no
PostgreSQL com `AT TIME ZONE`.

**Decisão.** O fuso vem de `GET /api/configuracao` (junto dos limites de duração), e todo
instante é montado com `instanteDeDataHoraLocal(data, hora, fuso)`. Nenhum `new Date()`
solto em componente.

**Por quê.** Montar o instante com o fuso do navegador faz o backend recusar o agendamento
com "horário fora da disponibilidade", sem que o usuário entenda por quê.

**Isto aconteceu de verdade.** Durante a verificação ponta a ponta, um reagendamento
voltou 409. A investigação mostrou que o erro estava no *script de teste*: a máquina está
em UTC−4 e a instituição em UTC−3. O backend estava certo em recusar. Os testes de
`lib/datas/fuso.ts` existem para que não se repita.

---

## AD-F05 — 409 é cidadão de primeira classe

**Decisão.** Conflitos de domínio (409) vão para `<Alert>` **inline**, que permanece na
tela; toasts ficam para confirmação de sucesso.

**Por quê.** Neste sistema, as regras mais importantes só se manifestam como conflito no
momento da escrita — RN03 (choque de horário), RN09 (acúmulo de papéis), vagas esgotadas,
transição de status inválida. Um "você já tem atendimento neste horário" que some em 4
segundos deixa a pessoa sem saber o que ajustar.

**Corolário.** As mensagens do backend já são escritas para o usuário final e são exibidas
como vieram. `mensagemDeErro()` só reescreve dois casos: 429 (o texto do throttler é
técnico) e 5xx (detalhe interno nunca vaza).

---

## AD-F06 — Server Components por padrão; cliente onde há interação

**Decisão.** Sessão, contexto de monitoria e metadados são resolvidos no servidor. Listas
com filtro, formulários e diálogos são Client Components com TanStack Query.

**Por quê.** O contexto da monitoria (`meuPapel`, `souResponsavel`, `meuParticipanteId`) é
resolvido **uma vez** no layout de `[monitoriaId]` e herdado por todas as abas. Sem isso,
cada aba repetiria `GET /monitorias/:id` só para descobrir o que o usuário pode fazer.

**Limite.** Não transformar tudo em Server Component: filtros que mudam a cada tecla
precisam de estado no cliente, e uma ida ao servidor por caractere gastaria o rate limit.

---

## AD-F07 — Sem store global

**Decisão.** TanStack Query para server state; cookie + RSC para sessão; URL para filtros
e paginação; `useState` para o resto.

**Por quê.** Não há estado global de cliente neste app. Redux ou Zustand seriam uma caixa
vazia com cerimônia. Filtros na URL tornam a tela compartilhável, recarregável e navegável
pelo botão "voltar".

**Detalhe que importa.** O QueryClient **não repete 4xx**: repetir 401/403/409 nunca muda o
resultado, e repetir 429 empurra o rate limit do backend (5 tentativas/min no login).

---

## AD-F08 — Paginação server-side; ordenação só onde a API oferece

**Decisão.** Onde o backend pagina, navegamos entre páginas reais. Onde ele **não** ordena
(6 das 8 listagens), o frontend **não** reordena.

**Por quê.** Ordenar client-side apenas a página atual produz uma ordem falsa — o item
"maior" pode estar na página seguinte. Uma ordenação errada é pior que a ausência dela.

---

## AD-F09 — Confirmação para ação destrutiva, mesmo sem exclusão real

**Contexto.** Nenhuma rota da API apaga dado (RN10): tudo é encerrar, desativar, cancelar
ou marcar como removido.

**Decisão.** Ainda assim, remover material, encerrar vínculo, desativar horário, sair da
monitoria e encerrar monitoria pedem confirmação — e o diálogo **explica que nada é
apagado**.

**Por quê.** "Remover" some das listagens e "encerrar" tira o acesso. O usuário não desfaz
isso sozinho. E o aviso ensina o modelo de dados junto com a ação.

**Exceção.** Ações que exigem **motivo** (cancelar atendimento, cancelar monitoria,
reagendar) têm diálogo próprio: precisam de campo, validação e mensagem de erro.

---

## AD-F10 — Política de produção verificada no boot, não no build

**Contexto.** Uma primeira versão validava `COOKIE_SECURE` no carregamento do módulo de
env. Isso quebrou o `npm run build`: o Next compila com `NODE_ENV=production` na máquina de
quem builda, que tem configuração de desenvolvimento.

**Decisão.** A validação de *forma* (Zod) fica no carregamento; a validação de *política*
roda em `instrumentation.ts`, que o Next executa uma vez quando o servidor sobe.

**O que é recusado em produção.** `COOKIE_SECURE=false` (o cookie iria sem `Secure`,
expondo o token em HTTP) e `API_URL` apontando para localhost.

**Por quê falhar em vez de avisar.** As duas falhas são silenciosas: a aplicação sobe e
funciona normalmente, e o defeito só apareceria numa auditoria.

---

## AD-F11 — Vitest, com integração em script separado

**Decisão.** Vitest + Testing Library para unidade e componente; scripts Python para
integração real.

**Por quê Vitest.** Entende `paths` do tsconfig e ESM sem configuração de transformação.

**Por quê não Playwright.** O alvo da integração é o **contrato HTTP e a sessão** — não a
renderização, já coberta pelos testes de componente. Um navegador headless verificaria as
mesmas respostas com mais dependências e mais falhas intermitentes. Se um dia for preciso
testar interação visual, Playwright é o próximo passo.

**Mocks.** Só nos testes de unidade. A integração usa a API real, como pedido.

---

## AD-F12 — Identidade visual própria, com tokens como única fonte

**Contexto.** A primeira versão usava a paleta padrão do Tailwind (slate + azul-700) e a
Inter. Funcionava, mas tinha a cara de qualquer template — e não dizia nada sobre o
domínio.

**Decisão.** Os tokens em `globals.css` (canais RGB) continuam sendo a única fonte de cor;
os componentes de `components/ui` só consomem tokens. O que mudou foi o conteúdo deles:

| Papel | Cor | Uso |
|---|---|---|
| Primária | azul-petróleo `#0F5E63` | ação principal, AGENDADO/PLANEJADA, foco, sidebar |
| Acento | coral `#E8793A` (texto: `#A34714`) | só o que pede ação: vaga livre, pendência, item atual do menu |
| Neutros | fundo `#F7F5F0`, texto `#211D18`, borda `#E5E0D6` | tom quente em vez do slate frio |
| Papel MONITOR | violeta-anil `#5440B8` | etiqueta com ícone de apresentação |
| Papel MONITORADO | teal `#0B6A6A` | etiqueta com ícone de livro |
| Professor responsável | terracota `#964422` | etiqueta com ícone de pasta |
| Disciplinas | 8 matizes de luminosidade parecida | faixa lateral e selo de iniciais |

**Status têm semântica fixa em todo o sistema:** programado (petróleo), positivo (verde),
atenção (âmbar), terminal (cinza) e descartado (anel vazio, esmaecido — CANCELADO não é
vermelho: não é erro, é algo que não vai acontecer). Selo e gráfico usam o mesmo mapa
(`TOM_STATUS_*` em `badge.tsx`).

**Ajuste sobre a proposta inicial.** MONITORADO (teal claro) e AGENDADO (petróleo) ficam
na mesma família de matiz. Em vez de afastar as cores e perder a coerência da paleta, a
distinção foi feita pela **forma**: status é ponto + rótulo sobre fundo neutro; papel é
etiqueta preenchida com ícone. Assim os dois nunca se confundem, inclusive para quem não
distingue as cores.

**Cor por disciplina.** Derivada do `codigo` por FNV-1a → índice de 0 a 7
(`lib/cores/disciplina.ts`). Estável entre telas e sessões, sem estado salvo. Colisões
são esperadas; a cor ajuda a localizar, o rótulo identifica.

**Contraste.** Todos os pares texto/fundo passam WCAG AA (4,5:1); os tons de
"preenchimento" (acento, disciplinas, papel monitorado) são para faixas, pontos e barras,
nunca para texto pequeno sobre claro. A cor nunca é a única portadora de informação.

**Tipografia.** Títulos em **Bricolage Grotesque** (grotesca com desenho próprio e eixo
de tamanho óptico: caráter sem ser decorativa). Texto em **Source Sans 3** (humanista,
desenhada para interface, com algarismos tabulares — horários, vagas e médias usam
`tabular-nums` e alinham em coluna). A Inter foi descartada por ser o padrão de quase todo
template. A escala `xs/sm/base` foi reajustada porque a Source Sans tem altura-x menor, e
há nomes semânticos (`titulo-pagina`, `titulo-secao`, `titulo-cartao`, `legenda`).

**Forma.** Cartão com borda fina e sem sombra (sombra só no que flutua: diálogo e menu);
hierarquia pelo espaço e pela faixa de cor. Estado vazio alinhado à esquerda, com
ilustração de traço simples e uma ação concreta. Esqueletos com o formato do conteúdo
final (`SkeletonCartaoMonitoria`, `SkeletonCartaoAtendimento`).

**O que foi evitado de propósito:** gradientes, glassmorphism, sombras exageradas, emojis,
ícone ao lado de cada título, grades de cartões idênticos para indicadores (viraram uma
faixa única), texto de marketing.

---

## AD-F13 — API desligada por inatividade: explicar e se recuperar sozinho

**Contexto.** A API roda numa hospedagem que desliga o servidor quando ninguém usa o
sistema por um tempo e o religa no acesso seguinte (cerca de 1 minuto). Nesse intervalo,
o layout autenticado chamava `GET /usuarios/eu`, a chamada falhava e a exceção subia até
a tela genérica do Next ("Application error: a server-side exception has occurred").

**Decisão.** A indisponibilidade é reconhecida **no servidor** e marcada:
`ErroServidorIndisponivel` (conexão recusada, timeout, ou 502/503/504 **fora** do formato
de erro do backend, ou seja, vindo da hospedagem) carrega `digest = SERVIDOR_INDISPONIVEL`.
O layout `(app)` captura o caso e renderiza `TelaServidorIndisponivel`; o BFF de login e o
proxy devolvem `erro: SERVIDOR_INDISPONIVEL` com mensagem em linguagem simples.

**Por que o `digest`.** Em produção o Next apaga a mensagem dos erros de servidor antes de
enviá-los ao navegador, mas preserva um `digest` já definido. É o único dado que permite a
`(app)/error.tsx` e a `global-error.tsx` reconhecerem o caso quando ele acontece no meio
do uso (navegação entre telas).

**A tela.** Explica o que acontece sem jargão, garante que nada foi perdido e recarrega
sozinha: verifica `GET /configuracao` a cada 10 s e recarrega assim que a API responde,
ou ao fim de 1 minuto. A contagem é calculada a partir do instante de início (abas em
segundo plano espaçam os timers). Após 3 recargas seguidas em 5 minutos, o texto admite
que o problema pode ser outro.

**O que não entra no caso.** Um 503 escrito pelo próprio backend (ex.: e-mail de senha
não enviado no cadastro) continua erro de domínio, com a mensagem dele. No navegador,
falha de rede sem resposta continua `ErroDeRede`: ali a causa pode ser a internet da
própria pessoa.

**Verificado** em build de produção com a API inacessível: `/inicio` e `/monitorias`
passaram de 500 para a tela de espera; login e proxy devolvem a resposta marcada.

---

## O que foi deliberadamente NÃO feito

| Item | Motivo |
|---|---|
| **Upload de material** | A API não oferece: `POST /materiais` só aceita link. Simular seria prometer o que o servidor não entrega |
| **Badges, níveis, conquistas** | Não existem no backend — só o livro-razão de pontos e o ranking |
| **Refresh token / renovação silenciosa** | O backend não expõe. O TTL de 8h e o tratamento de 401 cobrem o uso real |
| **Content-Security-Policy** | Uma CSP correta exige nonce por requisição; uma frouxa (`unsafe-inline`) daria falsa sensação de proteção. Registrado como próximo passo de endurecimento |
| **Modo escuro** | Fora do escopo; os tokens de cor em `globals.css` já permitem adicionar depois trocando um bloco (os pares de contraste precisariam ser reconferidos) |
| **i18n** | Aplicação monolíngue |
| **Storybook** | Não paga o custo neste escopo |
