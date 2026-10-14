# Frontend — Plataforma de Apoio à Monitoria

Frontend em Next.js (App Router) da Plataforma Digital para Apoio à Monitoria no Ensino
Superior. Consome o backend NestJS em `../backend`, que é a **fonte de verdade** dos
contratos.

> Estado atual: **completo para apresentação** — fundação, funcionalidades, testes e
> documentação. Integrado ao backend real, sem mocks fora dos testes de unidade.
>
> | Documento | Conteúdo |
> |---|---|
> | `docs/decisoes-arquiteturais.md` | as 11 decisões que moldaram o frontend, com alternativas descartadas |
> | `docs/analise-e-arquitetura-frontend.md` | análise do backend e o mapa API → frontend |
> | `docs/limitacoes-da-api.md` | o que a API não oferece e como a interface lida com isso |
> | `test/integracao/README.md` | como rodar a verificação contra a aplicação real |

---

## Pré-requisitos

- Node.js 20+
- Backend rodando em `http://localhost:3000` (com PostgreSQL)

## Configuração

```bash
npm install
cp .env.example .env.local
npm run dev
```

A aplicação sobe em **http://localhost:3001**. A porta não é arbitrária: o
`.env.example` do backend libera `http://localhost:3001` no CORS, e o backend
**fecha o CORS** quando `CORS_ORIGINS` está vazio.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `API_URL` | **sim** | URL do backend **com** o prefixo `/api`. Usada apenas no servidor |
| `SESSAO_COOKIE_NOME` | não | Nome do cookie de sessão (padrão `monitoria_sessao`) |
| `COOKIE_SECURE` | não | `true` em qualquer ambiente HTTPS |

Nenhuma variável tem prefixo `NEXT_PUBLIC_`, e isso é proposital: o navegador nunca fala
com o backend diretamente, então a URL da API não precisa ir para o bundle.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | desenvolvimento na porta 3001 |
| `npm run build` · `start` | build e execução de produção |
| `npm run typecheck` | `tsc --noEmit` (strict, com `noUncheckedIndexedAccess`) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | 101 testes de unidade e componente (Vitest) |
| `npm run test:watch` · `test:cov` | modo interativo · cobertura |
| `npm run test:integracao` | 54 verificações contra backend + PostgreSQL reais |

> Não rode `npm run build` com o `npm run dev` ativo: o build sobrescreve `.next` e
> derruba o servidor de desenvolvimento com `MODULE_NOT_FOUND`. Se acontecer,
> `rm -rf .next` e reinicie.

---

## Arquitetura

### Camadas

```
UI (componente)
  └─► feature (hook / schema)
        └─► service (features/*/api)
              └─► cliente HTTP (lib/api)
                    └─► backend NestJS
```

Nenhum componente chama `fetch` diretamente. Todo acesso passa por `lib/api/http.ts`,
que concentra timeout, cabeçalhos, serialização e a tradução de erro em `ApiError`.

### Autenticação — padrão BFF

O backend usa JWT Bearer stateless (TTL de 8h, sem refresh token). O token **nunca chega
ao JavaScript da página**:

```
Navegador ──(cookie httpOnly)──► Next.js ──(Authorization: Bearer)──► NestJS
```

- `POST /api/bff/login` troca credenciais por um cookie `httpOnly`, `sameSite=lax`,
  `secure` (configurável), com `maxAge` derivado de `expiraEmSegundos` — que o backend
  calcula a partir do claim `exp` do token realmente assinado.
- `app/api/backend/[...caminho]` é o proxy: lê o cookie e injeta o `Authorization`.
  Ele **bloqueia** os cabeçalhos `authorization`, `cookie` e `host` vindos do cliente,
  para que um script da página não consiga forjar o próprio Bearer.
- `POST /api/bff/logout` apaga o cookie. O backend é stateless e não revoga tokens, então
  o logout é, por construção, um ato do cliente.

Verificado no navegador: `document.cookie`, `localStorage` e `sessionStorage` ficam
**vazios** com a sessão ativa. Um XSS nesta página não rouba a sessão.

### Autorização

Três camadas, espelhando o backend — e **todas são UX**. A autorização real é do NestJS
(guards globais, `ParticipacaoGuard` e as constraints do PostgreSQL).

| Camada | Onde | Espelha |
|---|---|---|
| Perfil global | `lib/autorizacao/capacidades.ts` → `temPerfil` | `PerfilGuard` |
| Participação na monitoria | `capacidades(contexto)` | `@ExigeParticipacao` |
| Propriedade do recurso | `podeEditarMaterial`, `podeGerirAtendimento`, `podeAvaliar` | regras do service |

Uso na UI:

```tsx
<PodePorPerfil perfis={[PerfilUsuario.PROFESSOR]}> … </PodePorPerfil>
<Pode capacidade="habilitarMonitor"> <Button/> </Pode>
```

Regra de disciplina: **nenhuma verificação de papel fora de `lib/autorizacao/`**. Se
aparecer `meuPapel === 'MONITOR'` dentro de um componente, é para virar capacidade nomeada.

Se um **403** chegar à tela, é sintoma de divergência entre `capacidades.ts` e o backend —
vale investigar, não esconder.

### Proteção de rotas

| Camada | Responsabilidade |
|---|---|
| `middleware.ts` | só olha a **presença** do cookie. Não valida token nem lê perfis |
| `(app)/layout.tsx` | confirma a sessão de verdade com `GET /usuarios/eu` |
| backend | autoridade final (401/403) |

O middleware exclui `/api` do matcher de propósito: uma chamada de API precisa receber
401 em JSON, não o HTML da página de login.

**Onde redirecionar:** `redirect()` só produz um 307 limpo quando acontece **antes do
primeiro flush** — ou seja, em layouts. Chamado dentro de uma página, o layout já começou
a ser transmitido e o Next cai num `<meta http-equiv="refresh">` de 1 segundo, com a tela
restrita piscando. Por isso páginas usam `verificarPerfil` + `<SemAcesso>`.

### Estado

| Tipo | Mecanismo |
|---|---|
| Server state | TanStack Query + RSC |
| Sessão | cookie httpOnly + `GET /usuarios/eu` no layout → `SessaoProvider` |
| Contexto da monitoria | `MonitoriaProvider` (papel, capacidades) |
| UI (filtros, paginação) | URL (`searchParams`) e `useState` |

Sem Redux/Zustand: não há estado global de cliente para guardar.

O QueryClient **não repete respostas 4xx** — repetir 401/403/409 nunca muda o resultado, e
repetir 429 empurra o rate limit do backend. Um 401 em qualquer query derruba a sessão
inteira uma única vez, em vez de gerar N toasts.

### Fuso horário — a armadilha do projeto

O backend guarda atendimentos em `TIMESTAMPTZ`, mas a disponibilidade do monitor é
declarada em **hora local da instituição**, e a validação da janela roda no PostgreSQL com
`AT TIME ZONE`. Montar o instante a partir do fuso do **navegador** faz o agendamento ser
recusado com "horário fora da disponibilidade", sem que o usuário entenda por quê.

Por isso o fuso vem de `GET /api/configuracao` (junto dos limites de duração e
antecedência) e todas as conversões passam por `lib/datas/fuso.ts`. Nada de `new Date()`
solto em componente.

### Tratamento de erros

Toda falha vira `ApiError` com `statusCode`, `erro`, `mensagem` e `detalhes`.

| Status | Tratamento |
|---|---|
| 400 | `detalhes[]` volta para os campos do formulário |
| 401 | limpa a sessão e redireciona para `/login?expirou=1` |
| 403 | `<SemAcesso>` ou `<EstadoErro>` com a mensagem do backend |
| 409 | **conflito de domínio** — `<Alert>` inline, que permanece na tela |
| 429 | mensagem própria (a do throttler é técnica demais) |
| 5xx | mensagem genérica; detalhe interno nunca vaza |

`409` é cidadão de primeira classe aqui: RN03, RN09, vagas e transições de status só se
manifestam como conflito no momento da escrita. Por isso vão em `<Alert>` inline, e não em
toast — o texto precisa continuar visível enquanto o usuário corrige o formulário.

`mensagemDeErro()` é o **único** lugar que decide o texto exibido.

---

## Estrutura de pastas

```
src/
├── app/
│   ├── (publico)/        login e recuperação de senha (não há auto-cadastro)
│   ├── (app)/            área autenticada (layout confirma a sessão)
│   └── api/
│       ├── bff/          login e logout — únicos a tocar no cookie
│       └── backend/      proxy autenticado
├── components/
│   ├── ui/               design system (button, campo, card, badge, alert,
│   │                     dialog, dropdown, tabs, tabela, skeleton, estados, toast)
│   ├── layout/           app-shell, navegação, menu do usuário, cabeçalho
│   ├── autorizacao/      <Pode>, <PodePorPerfil>, <SemAcesso>
│   └── comum/            componentes transversais
├── features/             auth · usuarios · configuracao · disciplinas · monitorias
│                         disponibilidades · atendimentos · avaliacoes · materiais
│                         gamificacao · analytics · dashboard
│                         (cada uma com api/ schemas/ hooks/ components/)
├── lib/
│   ├── api/              http, servidor, cliente, erros
│   ├── auth/             cookie, sessão
│   ├── autorizacao/      capacidades  ← espelho único das regras do backend
│   ├── datas/            fuso horário
│   └── query/            query keys
├── providers/            query, sessão, monitoria
├── config/               env (validado com Zod), rotas, navegação
├── types/                dominio.ts (espelha o backend), api.ts
└── middleware.ts
```

Regra: **tipo, schema e chamada de API moram na feature dona**. Só o que é genuinamente
transversal desce para `lib/` ou `components/`.

---

## Armadilhas de integração

1. **`alunoId` ≠ `participanteId`.** `alunoId` é o **id do usuário** (as tabelas `alunos` e
   `professores` têm `usuario_id` como PK). `participanteId` é o id do **vínculo** em
   `monitoria_participantes`. O próprio vínculo vem pronto em `monitoria.meuParticipanteId`.
2. **`ausentes` em `/realizar` recebe ids de INSCRIÇÃO**, não de participante.
3. **`diaSemana` é 0 = domingo**; `horaInicio` entra como `"HH:MM"` e volta como `"HH:MM:SS"`.
4. **`perfis` é uma lista** — um usuário pode ser ALUNO **e** PROFESSOR.
5. **`forbidNonWhitelisted` está ligado no backend:** mandar um campo a mais devolve 400.
   Nunca espalhe o objeto do formulário inteiro no corpo (é por isso que
   `confirmacaoSenha` não é enviada).
6. **Nenhuma rota aceita `DELETE`** (RN10). Todo "remover" é um `POST` de ação.
7. **`aceitaInscricao` vem calculado no servidor** — não recalcule com `Date.now()`.
8. **`/monitorias/minhas` traz só PLANEJADA+ATIVA por padrão** e é paginado.

---

## Verificação da fundação

Testado contra o backend real (PostgreSQL + NestJS), com os usuários do seeder:

| # | Verificação | Resultado |
|---|---|---|
| 1 | Rota protegida sem sessão | 307 → `/login?destino=/inicio` |
| 2 | Proxy sem sessão | **401 em JSON**, não HTML |
| 3 | Login pelo BFF | 200 |
| 4 | Cookie gravado | `HttpOnly; SameSite=lax; Max-Age=28800` |
| 5 | Token no corpo da resposta | **ausente** |
| 6 | Token acessível ao JS | `document.cookie`, `localStorage`, `sessionStorage` vazios |
| 7 | Cliente forjando `Authorization` no proxy | ignorado → 401 |
| 8 | Aluno em `/disciplinas` (rota de professor) | `<SemAcesso>`, sem flash |
| 9 | Professor em `/disciplinas` | conteúdo renderizado |
| 10 | Menu por perfil | professor vê "Disciplinas"; aluno não |
| 11 | Autenticado visitando `/login` | 307 → `/inicio` |
| 12 | Logout | cookie apagado; rota volta a redirecionar |
| 13 | Credenciais inválidas | `role="alert"` com a mensagem do backend |
| 14 | Rate limit (6 tentativas) | 429 com mensagem própria |
| 15 | Mobile 375px | sem scroll horizontal; gaveta abre, trava o scroll e fecha no Esc |

`npm run typecheck`, `npm run lint` e `npm run build` passam sem avisos.


---

## Funcionalidades implementadas

| Área | O que existe |
|---|---|
| **Dashboard** | Visões separadas para professor (indicadores de `/analytics/resumo`) e aluno (monitorias com papel, próximos atendimentos, avaliações pendentes, pontos). Quem acumula os dois perfis vê as duas seções |
| **Disciplinas** | Listagem com busca e filtro, cadastro, edição, ativação/desativação. Restrito a PROFESSOR |
| **Recuperação de senha** | Código de 6 dígitos por e-mail, depois código + nova senha. Pública e aberta também com sessão; link no login e em Minha conta. Nunca revela se o e-mail tem conta |
| **Pessoas** | Alunos (com busca) e professores; cadastro de ambos com senha provisória e tela de dados de acesso. Restrito a PROFESSOR — é o único lugar onde contas são criadas |
| **Monitorias** | Catálogo com busca, "minhas monitorias" com o papel em cada uma, criação, edição, transições de status (ativar/encerrar/cancelar) |
| **Participantes** | Lista com filtro por papel e situação, busca de alunos, habilitar monitor (RN01), inscrever monitorado, auto-inscrição, encerrar vínculo, histórico de encerrados |
| **Disponibilidade** | Grade semanal (lista no mobile), criar e desativar faixas. Só para quem é MONITOR ali |
| **Atendimentos** | Agenda da monitoria e agenda pessoal, agendamento com resumo de confirmação, detalhe com inscrições e histórico, inscrever/desistir, registrar presença, cancelar, reagendar |
| **Avaliações** | Modal com nota 1–5 e comentário, habilitado apenas quando o backend marca `podeAvaliar`. Resumo com média por atendimento |
| **Materiais** | Acervo com publicação de link, edição, remoção lógica e visualização de removidos |
| **Gamificação** | Ranking geral com destaque da própria posição, extrato de pontos por tipo e últimos eventos |
| **Indicadores** | Por monitoria (atendimentos por status, taxa de participação, avaliações, materiais) e atividade por monitor, restrita ao professor responsável |

Sem badges, níveis ou upload de arquivo: **não existem na API** e não foram simulados.

## Verificação das funcionalidades

Fluxo completo exercitado **através do frontend** (cookie httpOnly + proxy `/api/backend`),
contra PostgreSQL e NestJS reais — **27 verificações, todas passando**:

| Grupo | Verificações |
|---|---|
| Sessões | login de professor e de aluna |
| Disciplina e monitoria | cria disciplina, cria monitoria (nasce PLANEJADA), ativa |
| Participantes | habilita monitor (RN01), **recusa acúmulo de papéis (RN09, 409)**, busca exclui quem já participa |
| Contexto | aluna vê `meuPapel=MONITOR`; `meuParticipanteId` é o id do vínculo; professor vê `souResponsavel` sem papel |
| Agendamento | declara disponibilidade, abre sessão, `origem=OFERTA_MONITOR`, `aceitaInscricao` do servidor, resumo da monitoria sem N+1 |
| Regras de horário | **recusa sobreposição do monitor (RN03, 409)**, **recusa horário fora da disponibilidade (409)** |
| Reagendamento | reagenda mantendo AGENDADO, **evento fica no histórico (RN10)** |
| Materiais | monitora publica, professor responsável vê o acervo |
| Indicadores | por monitoria, resumo da plataforma, **aluno barrado no resumo (403)** |
| Ciclo de vida | **recusa encerrar monitoria com atendimento agendado (409)** |

Todas as páginas renderizam 200 para ambos os perfis, e `/disciplinas` mostra "área
restrita" para aluno.

`npm run typecheck`, `npm run lint` e `npm run build` (23 rotas) passam sem avisos.


---

## Testes

| Camada | Ferramenta | O que cobre |
|---|---|---|
| Unidade e componente | Vitest + Testing Library | **101 testes** |
| Integração real | scripts em `test/integracao/` | **54 verificações** contra NestJS + PostgreSQL |

Mocks existem **apenas** nos testes de unidade. A integração usa a API real.

### O que os testes de unidade cobrem

| Arquivo | Foco |
|---|---|
| `autorizacao.spec.ts` | 23 — o espelho das regras do backend: papel por monitoria, professor `NEGADO` em disponibilidade/agendamento, propriedade de material, RN05/RN06 |
| `papel-contextual.spec.tsx` | 12 — **o conceito central do TCC**: o mesmo usuário tem capacidades diferentes em monitorias diferentes |
| `login.spec.tsx` | 10 — credenciais, **open redirect**, 401 sem enumeração de contas, 429, duplo clique, acessibilidade |
| `erros.spec.ts` | 18 — classificação HTTP, mensagens, `detalhes[]` de volta aos campos, 5xx sem vazamento |
| `http.spec.ts` | 12 — query string (arrays repetidos), 204 sem corpo, tradução de erro, cabeçalhos |
| `fuso.spec.ts` | 13 — conversão no fuso da instituição, ida e volta, dia da semana 0 = domingo |
| `avaliacao.spec.tsx` | 7 — corpo sem autor/inscrição, conflito do backend, estrelas como `radiogroup` |
| `configuracao.spec.ts` | 9 — política de produção sem quebrar o build |

### Integração

```bash
# com backend (:3000) e frontend (:3001) no ar
npm run test:integracao
```

`fluxo-dominio.py` (27) percorre disciplina → monitoria → habilitação de monitor →
disponibilidade → agendamento → reagendamento → materiais → indicadores, incluindo os 409
que **são** as regras (RN09, RN03, fora da disponibilidade, encerrar com agendados).

`seguranca.py` (27) cobre os quatro cenários de sessão, atributos do cookie, tentativa de
forjar `Authorization` no proxy, autorização por perfil e por participação, logout e
sanidade das respostas de erro.

---

## Configuração de produção

```bash
npm run build && npm start
```

O build gera saída `standalone`. Antes de subir, defina:

```
NODE_ENV=production
API_URL=https://api.suainstituicao.edu.br/api
COOKIE_SECURE=true
SESSAO_COOKIE_NOME=monitoria_sessao
```

**A aplicação se recusa a subir** (via `instrumentation.ts`, no boot) se em produção:

- `COOKIE_SECURE` for `false` — o cookie iria sem a flag `Secure`, expondo o token em HTTP;
- `API_URL` apontar para `localhost`.

As duas falhas são silenciosas: a aplicação funcionaria normalmente e o defeito só
apareceria numa auditoria. Falhar no boot é a escolha deliberada — a mesma que o backend
faz com `CODIGO_CADASTRO_PROFESSOR`.

**Segredos.** Não há nenhum no frontend: a URL da API não é secreta, e o `JWT_SECRET` vive
apenas no backend. `.env.local` está no `.gitignore`; `.env.example` documenta as variáveis
sem valores reais.

**Cabeçalhos** (`next.config.mjs`): `X-Content-Type-Options: nosniff`, `X-Frame-Options:
DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy` restritiva e `X-Powered-By`
removido. Sem CSP — ver `docs/decisoes-arquiteturais.md`, seção final.

**Logs.** O boot registra ambiente, URL da API e `cookieSecure`, sem segredos. Erros 5xx e
falhas do proxy ficam no log do servidor; o cliente recebe mensagem genérica.

---

## Checklist de entrega

| Item | Situação | Onde verificar |
|---|---|---|
| Login | ✅ | `test/login.spec.tsx` · integração §4 |
| Logout | ✅ | integração §7 (cookie com `Max-Age=0`) |
| Rotas privadas protegidas | ✅ | integração §1 (6 rotas → 307 `/login`) |
| Sessão expirada tratada | ✅ | integração §2 · `?expirou=1` no login |
| Autorização implementada | ✅ | `autorizacao.spec.ts` · integração §5 e §6 |
| Fluxos do professor | ✅ | disciplinas, monitorias, participantes, indicadores |
| Fluxos do aluno | ✅ | monitorias, disponibilidade, agendamento, avaliação, gamificação |
| **Monitor/monitorado como papel da monitoria** | ✅ | `papel-contextual.spec.tsx` |
| Monitorias | ✅ | integração §"Disciplina e monitoria" |
| Participantes | ✅ | integração §"Participantes (RN01)" |
| Disponibilidade | ✅ | integração §"Disponibilidade e agendamento" |
| Agendamento | ✅ | idem · resumo antes de confirmar |
| Cancelamento | ✅ | diálogo com motivo obrigatório (RN10) |
| Atendimento (realização) | ✅ | presença por pessoa, ausentes por id de inscrição |
| Avaliação | ✅ | `avaliacao.spec.tsx` — só com `podeAvaliar` do servidor |
| Materiais | ✅ | link apenas — a API não tem upload |
| Gamificação | ✅ | ranking e extrato; sem badges (não existem na API) |
| Analytics | ✅ | por monitoria e por monitor (restrito ao responsável) |
| Loading / skeleton | ✅ | `loading.tsx` + skeletons por lista |
| Error states | ✅ | `error.tsx` no grupo `(app)` + `<EstadoErro>` por seção |
| Empty states | ✅ | `<EstadoVazio>` acionável em todas as listas |
| Responsividade | ✅ | 375px sem scroll horizontal; tabelas viram cartões |
| Acessibilidade | ✅ | labels, `aria-invalid`/`describedby`, foco visível, `radiogroup` |
| Testes | ✅ | 101 unidade + 54 integração |
| API consumida corretamente | ✅ | tipos espelham os DTOs; conferido contra `/docs-json` |
| README atualizado | ✅ | este arquivo |
| Build de produção | ✅ | `npm run build` — 23 rotas, sem avisos |
