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

## O que foi deliberadamente NÃO feito

| Item | Motivo |
|---|---|
| **Upload de material** | A API não oferece: `POST /materiais` só aceita link. Simular seria prometer o que o servidor não entrega |
| **Badges, níveis, conquistas** | Não existem no backend — só o livro-razão de pontos e o ranking |
| **Refresh token / renovação silenciosa** | O backend não expõe. O TTL de 8h e o tratamento de 401 cobrem o uso real |
| **Content-Security-Policy** | Uma CSP correta exige nonce por requisição; uma frouxa (`unsafe-inline`) daria falsa sensação de proteção. Registrado como próximo passo de endurecimento |
| **Modo escuro** | Fora do escopo; os tokens de cor em `globals.css` já permitem adicionar depois trocando um bloco |
| **i18n** | Aplicação monolíngue |
| **Storybook** | Não paga o custo neste escopo |
