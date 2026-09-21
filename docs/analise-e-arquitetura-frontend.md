# Análise do Backend e Arquitetura Proposta para o Frontend

> Documento da etapa 1 — **análise e projeto**. Nenhuma tela foi implementada ainda.
> Fonte de verdade: código-fonte em `backend/src`. Onde `backend/docs/arquitetura.md`
> diverge do código, **o código prevalece**; a divergência está registrada na seção 19.
>
> Backend analisado: NestJS 11 + Sequelize 6 + PostgreSQL — 13 models, 12 módulos de
> domínio, 47 endpoints REST, Swagger em `/docs`.
>
> **Revisão 2 (2026-09-08)** — o backend implementou os ajustes solicitados. As seções
> 3, 4, 6, 19 e o apêndice foram atualizados. Resumo do que mudou para o frontend:
>
> | Mudança | Impacto |
> |---|---|
> | 🆕 `GET /api/configuracao` (público) | fuso da instituição e limites de agendamento vêm do servidor — **não hardcode** |
> | TTL do JWT: 1h → **8h**; `+expiraEmSegundos`, `+expiraEmIso` | `maxAge` do cookie sai pronto; `expiraEm` está *deprecated* |
> | ⚠️ `GET /monitorias/minhas` virou paginado e **filtra PLANEJADA+ATIVA por padrão** | para ver histórico é preciso pedir `?status=` explicitamente |
> | `+meuParticipanteId` em monitorias | resolve o G7 antigo — sem varrer `/participantes` |
> | `+monitoria{}` e `+aceitaInscricao` em atendimentos | mata o N+1 de "Meus atendimentos" e a derivação no cliente |
> | `+souEu/jaAvaliei/podeAvaliar` na própria inscrição | o botão "Avaliar" passa a ter estado correto |
> | 🆕 `POST /atendimentos/:id/reagendar` | substitui o "cancelar e recriar" |
> | 🔓 disponibilidades visíveis a qualquer autenticado | o aluno vê horários **antes** de se inscrever |
> | `?busca=` em `/alunos` e `/monitorias` | fluxo RN01 e explorar monitorias ficam viáveis |
> | `?ordenarPor`/`?direcao` **só** nas 2 rotas de atendimento | nas outras 6 listagens a ordem segue fixa |

---

## 1. Análise do backend

### 1.1 Stack e estilo

| Item | Valor |
|---|---|
| Framework | NestJS 11 (`@nestjs/platform-express`) |
| Linguagem | TypeScript 5.9 |
| ORM | `sequelize` 6 + `sequelize-typescript` (models decorados, `@InjectModel`) |
| Banco | PostgreSQL (extensões `citext`, `btree_gist`) |
| Migrations | `sequelize-cli`, 15 migrations versionadas — `synchronize: false` (proibido) |
| Auth | `@nestjs/jwt` + `passport-jwt`, HS256; argon2id para senha |
| Validação | `class-validator` + `class-transformer`, `ValidationPipe` global |
| Documentação | `@nestjs/swagger` — OpenAPI em `http://localhost:3000/docs` (**sem** o prefixo `api`) |
| Segurança | `helmet`, `@nestjs/throttler`, CORS explícito |
| Eventos | `@nestjs/event-emitter` (in-process, sem fila) |
| Testes | Jest — 5 suítes de unidade + script E2E (`npm run test:fluxo`) |

Estilo: **monólito modular em camadas**. `Controller → Service → Model → PostgreSQL`.
Sem camada de repositório, sem CQRS, sem hexagonal (AD-01).

### 1.2 Estrutura de pastas real

```
backend/src/
├── main.ts                     # prefixo global `api`, helmet, ValidationPipe, CORS, Swagger
├── app.module.ts               # ThrottlerGuard + TodasExcecoesFilter globais
├── config/                     # configuration.ts (tipado) + env.validation.ts (Joi)
├── database/                   # database.module.ts, migrations/, seeders/
├── common/
│   ├── decorators/             # @Publico @Perfis @ExigeParticipacao @UsuarioAtual @ContextoMonitoria
│   ├── dto/                    # PaginacaoDto, RespostaPaginada, RespostaErro
│   ├── enums/                  # 10 enums de domínio
│   ├── filters/                # TodasExcecoesFilter (formato único de erro)
│   ├── guards/                 # JwtAuthGuard, PerfilGuard  (ambos GLOBAIS)
│   └── types/                  # UsuarioAutenticado
└── modules/
    ├── auth/   usuarios/   disciplinas/   monitorias/
    ├── disponibilidades/   atendimentos/   avaliacoes/   materiais/
    └── gamificacao/   analytics/
```

**Não existem** no código, apesar de citados no documento de arquitetura:
`infra/storage/`, `StorageModule`, `inscricoes.controller.ts`, `inscricoes.service.ts`,
pasta `test/e2e/`. Ver seção 19.

### 1.3 Models Sequelize e relacionamentos

13 models registrados em `DatabaseModule`:

| Model | Tabela | Observação |
|---|---|---|
| `Usuario` | `usuarios` | `id` uuid; `senhaHash` fora do `defaultScope` |
| `Aluno` | `alunos` | **PK = `usuario_id`** (1:1) |
| `Professor` | `professores` | **PK = `usuario_id`** (1:1) |
| `Disciplina` | `disciplinas` | `codigo` UNIQUE |
| `Monitoria` | `monitorias` | `disciplinaId`, `professorId`, `ano`, `semestre`, `status` |
| `MonitoriaParticipante` | `monitoria_participantes` | **entidade-chave**: `papel`, `status`, `ingressouEm`, `encerradoEm` |
| `Disponibilidade` | `disponibilidades` | `participanteId` (monitor), `diaSemana` 0–6, `horaInicio/Fim` |
| `Atendimento` | `atendimentos` | a *sessão*: `monitorParticipanteId`, `inicio/fim`, `vagas`, `origem` |
| `AtendimentoParticipante` | `atendimento_participantes` | a *inscrição*: `participanteId`, `status` |
| `AtendimentoStatusHistorico` | `atendimento_status_historico` | append-only |
| `Avaliacao` | `avaliacoes` | aponta para a **inscrição**, não para o atendimento |
| `Material` | `materiais` | `tipo`, `url`, `removidoEm` (soft delete) |
| `PontuacaoEvento` | `pontuacao_eventos` | livro-razão de pontos |

> **Consequência decisiva para o frontend.**
> Como `alunos.usuario_id` e `professores.usuario_id` são a PK, **`alunoId` e
> `professorId` em toda a API são o `id` do usuário**. Não existe "id de aluno"
> separado — `HabilitarParticipanteDto.alunoId` recebe o `usuario.id`.
>
> Já `participanteId` é outra coisa: é o **id do vínculo** (`monitoria_participantes.id`),
> e é ele que aparece em disponibilidades, atendimentos, inscrições e avaliações.
> Confundir os dois é o erro de integração mais provável neste projeto.

### 1.4 Integridade garantida no banco

O backend delega regras críticas a constraints. O frontend **não deve** replicá-las como
verdade — apenas antecipá-las na UX e traduzir o 409 que volta.

| Constraint | Regra | Efeito visível |
|---|---|---|
| `ux_participante_ativo` (índice único parcial) | RN09 — um vínculo ATIVO por (monitoria, aluno) | 409 |
| `uq_participante_contexto UNIQUE (id, monitoria_id, papel)` | alvo das FKs compostas | — |
| `fk_atendimento_monitor` (FK composta com `papel`) | quem atende é MONITOR daquela monitoria | 409 |
| `fk_inscricao_participante` | quem é atendido é MONITORADO daquela monitoria | 409 |
| `ex_monitor_sem_conflito` (`EXCLUDE USING gist`) | RN03 — agenda do monitor | 409 |
| `ex_aluno_sem_conflito` (`EXCLUDE USING gist`) | RN03 — agenda do aluno | 409 |
| `ex_disponibilidade_sem_sobreposicao` | faixas semanais não se sobrepõem | 409 |
| `ck_atendimento_cancelamento` | CANCELADO exige `motivo_cancelamento` | 400/409 |
| `uq_monitoria_oferta` | uma oferta por (disciplina, professor, ano, semestre) | 409 |

Todas são traduzidas para mensagem de domínio em `TodasExcecoesFilter` — o frontend pode
**exibir `mensagem` diretamente ao usuário final**, ela já é redigida para isso.

### 1.5 Enums (contrato fechado)

```ts
PerfilUsuario         = ALUNO | PROFESSOR
StatusMonitoria       = PLANEJADA | ATIVA | ENCERRADA | CANCELADA
PapelMonitoria        = MONITOR | MONITORADO
StatusParticipacao    = ATIVO | ENCERRADO
StatusAtendimento     = AGENDADO | REALIZADO | CANCELADO
StatusInscricao       = INSCRITO | PRESENTE | AUSENTE | CANCELADA
OrigemAtendimento     = SOLICITACAO_ALUNO | OFERTA_MONITOR
ModalidadeAtendimento = PRESENCIAL | REMOTO
TipoMaterial          = LINK | ARQUIVO      // ARQUIVO existe no schema; nenhum endpoint o produz
TipoPontuacao         = ATENDIMENTO_REALIZADO | PARTICIPACAO_ATENDIMENTO | AVALIACAO_RECEBIDA
// DiaSemana: smallint 0..6, 0 = domingo (compatível com Date.getDay())
```

### 1.6 Regras de negócio implementadas

| RN | Regra | Onde vive |
|---|---|---|
| RN01 | Só o professor responsável habilita monitores | rota `/monitores` + `ParticipacaoGuard(EXIGIDO)` + `habilitadoPorUsuarioId` |
| RN02 | Monitor habilitado na disciplina certa | estrutural (monitoria → 1 disciplina) |
| RN03 | Sem conflito de horário | duas constraints `EXCLUDE` |
| RN04 | Aluno precisa estar associado à monitoria | FKs compostas + `ParticipacaoService` |
| RN05 | Só o monitorado participante avalia | avaliação referencia a inscrição do próprio requisitante |
| RN06 | Avaliar só após conclusão | `status = REALIZADO` **e** `inscricao = PRESENTE` |
| RN07 | Só participantes acessam materiais | `ParticipacaoGuard` + checagem de monitoria no service |
| RN08 | Publicam professor responsável e MONITOR | `@ExigeParticipacao({papeis:[MONITOR], professorResponsavel:'PERMITIDO'})` |
| RN09 | Um aluno não acumula papéis | índice único parcial |
| RN10 | Não destruir histórico | **nenhum `DELETE` em toda a API** |

Regras adicionais encontradas no código e ausentes do README — importantes para a UI:

- **Agendamento:** duração mínima **15 min**, máxima **240 min**; não permite passado
  (`AtendimentosService.validarIntervalo`). D-15 segue em aberto; hoje são constantes no código.
- Agendar exige monitoria **ATIVA**. Já a auto-inscrição como MONITORADO só exige que ela
  **não** esteja ENCERRADA/CANCELADA — ou seja, é possível entrar em monitoria `PLANEJADA`.
- O horário precisa **caber inteiro** dentro de uma faixa de disponibilidade ativa do monitor,
  no mesmo dia local, no fuso `TIMEZONE_INSTITUICAO` (`validarJanela`, em SQL com `AT TIME ZONE`).
- Encerrar/cancelar monitoria **falha (409)** se houver atendimentos AGENDADOS — não cascateia.
- Encerrar vínculo **falha (409)** se o participante tiver atendimentos/inscrições ativas.
- Cancelar a última inscrição de um atendimento de origem `SOLICITACAO_ALUNO`
  **cancela o atendimento automaticamente**.
- Reinscrição após desistência reaproveita a linha (`CANCELADA → INSCRITO`).
- Editar/remover material exige ser **o autor** ou o professor responsável — um monitor
  não mexe no material de outro monitor.
- Gamificação roda como **ouvinte de evento pós-commit**; falha nela nunca derruba a
  operação de domínio, e concessão duplicada é no-op.

### 1.7 Paginação, filtros e ordenação

`PaginacaoDto`: `pagina` (≥1, default 1) e `limite` (1..100, default 20).
Resposta: `{ dados: T[], meta: { total, pagina, limite, totalPaginas } }`.

Filtros existentes: disciplinas (`busca`, `ativa`); monitorias (`disciplinaId`,
`professorId`, `ano`, `semestre`, `status`); participantes (`papel`, `status`);
atendimentos (`status`, `de`, `ate`, `monitorParticipanteId`); disponibilidades
(`participanteId`, `ativa`); materiais (`incluirRemovidos`); ranking (`monitoriaId`, `limite`).

**Não existe ordenação configurável pelo cliente em nenhum endpoint** — a ordem é fixa no
service. Ordenação alternativa é responsabilidade do frontend (client-side).

### 1.8 Upload/download de arquivos

**Não implementado.** Material é sempre `tipo = LINK`, com `url` restrita a `http`/`https`.
As colunas `arquivo_*` e o valor `ARQUIVO` existem no schema, mas nenhum endpoint os produz
e não há `StorageModule`. O frontend **não deve** oferecer upload nesta versão.

---

## 2. Resumo da arquitetura encontrada

Três decisões do backend definem a forma do frontend:

1. **Papel é contextual, não é tipo de usuário.** `MONITOR`/`MONITORADO` vivem em
   `monitoria_participantes.papel`; o token carrega apenas `ALUNO`/`PROFESSOR`. Toda tela de
   monitoria precisa resolver "qual é o meu papel *aqui*" antes de decidir o que mostrar.
   O backend entrega isso pronto: `MonitoriaRespostaDto.meuPapel` e `.souResponsavel`.

2. **Operações de domínio, não CRUD.** Não existe `PATCH /monitorias/:id { status }`;
   existem `POST /ativar`, `/encerrar`, `/cancelar`. Não existe `PATCH /atendimentos/:id`;
   existem `/realizar`, `/cancelar`, `/inscricao`. A UI é construída em torno de **ações**,
   não de formulários de edição genéricos.

3. **Não existe `DELETE` em lugar nenhum (RN10).** Todo "remover" é encerrar, desativar,
   cancelar ou marcar como removido. A UI nunca deve dizer "excluir permanentemente".

---

## 3. Resumo da API

- Prefixo global `/api`; Swagger em `/docs` (fora do prefixo).
- Autenticação `Authorization: Bearer <jwt>` em tudo, exceto três rotas públicas.
- **Formato de erro único em 100% das respostas** (inclusive as levantadas em guards e pipes):

```json
{
  "statusCode": 409,
  "erro": "Conflict",
  "mensagem": "Este monitor ja possui outro atendimento que se sobrepoe a este horario (RN03).",
  "detalhes": ["email deve ser um endereco de e-mail valido"],
  "caminho": "/api/monitorias/.../atendimentos",
  "timestamp": "2026-09-08T12:00:00.000Z"
}
```

`detalhes` só aparece em erro de validação (400). `mensagem` é sempre exibível ao usuário.

- Rate limit: 120 req/min global, **5/min no login**, 10/min nos cadastros → tratar **429**.
- CORS fechado se `CORS_ORIGINS` estiver vazio. O `.env.example` aponta
  `http://localhost:3001` → **o frontend deve rodar na porta 3001**.

---

## 4. Modelo de autenticação

### 4.1 Como o backend faz

- `POST /api/auth/login` → `{ tokenDeAcesso, tipoToken: "Bearer", expiraEm, expiraEmSegundos,
  expiraEmIso, usuario }`. Use **`expiraEmSegundos`** para o `maxAge` do cookie;
  `expiraEm` (`"8h"`) está marcado como *deprecated* e serve só para exibição.
- Payload do JWT: `{ sub, email, perfis[] }`. HS256, TTL de `JWT_EXPIRES_IN` (**default `8h`**,
  decisão D-09: cobre uma jornada de trabalho, sem refresh token).
- `JwtStrategy.validate` **recarrega o usuário do banco a cada requisição**: usuário
  desativado perde acesso na hora e `perfis` vêm sempre atuais. O `perfis` do token é
  conveniência para o cliente — o backend não confia nele.
- `JwtAuthGuard` é **global**: rota nova nasce protegida; liberar exige `@Publico()`.
- **Não há refresh token, `/auth/logout`, nem revogação.** Sessão stateless de 8 horas
  (D-09 decidida; refresh rotativo com tabela de sessões fica registrado como *projetado*).
- Cadastro: aluno aberto; professor pode exigir `codigoCadastro`
  (`CODIGO_CADASTRO_PROFESSOR`); ambos podem ser restritos por domínio de e-mail.

### 4.2 Como o frontend deve fazer — padrão BFF

**Recomendação: o token nunca chega ao JavaScript do navegador.**

```
Navegador ──(cookie httpOnly)──> Next.js (Route Handler / RSC) ──(Bearer)──> NestJS
```

1. `POST /bff/login` (Route Handler) recebe e-mail/senha, chama `POST /api/auth/login` no
   Nest e grava o `tokenDeAcesso` em cookie **`httpOnly`, `secure` em produção,
   `sameSite=lax`, `path=/`**, com `maxAge` derivado do claim `exp` do JWT.
2. Todo acesso do navegador à API passa por um **proxy único**
   `app/api/backend/[...path]/route.ts`, que lê o cookie e injeta o header `Authorization`.
   Server Components e Server Actions chamam o Nest **direto**, lendo o cookie via `cookies()`.
3. `POST /bff/logout` apaga o cookie. Como o backend é stateless, logout é exclusivamente
   client-side — e é justamente por isso que o TTL curto de 1h importa.

**Por que não `localStorage`:** qualquer XSS (inclusive via `url` de material — que o
backend restringe a http/https exatamente por esse motivo) leria e exfiltraria o token.
Cookie `httpOnly` não é legível por script. **Por que não cookie legível pelo JS:** mesma
falha, com um passo a menos para o atacante.

**Detecção de expiração.** Use `expiraEmSegundos` (para o `maxAge` do cookie) e
`expiraEmIso` (para avisar o usuário antes de expirar) — ambos derivados do claim `exp` do
token efetivamente assinado. Não decodifique o JWT no cliente nem interprete a string
`expiraEm`. A verdade continua sendo a resposta do backend:

- **401** em qualquer chamada → limpar cookie e redirecionar para `/login?expirou=1`.
- Bootstrap de sessão: `GET /api/usuarios/eu`. É a única fonte confiável de identidade e
  perfis; nunca derive perfis do JWT decodificado para decisões que importem.

**Proteção de rotas — três camadas, todas de UX** (a segurança real é do backend):
`middleware.ts` (existe cookie? senão redireciona), layout do grupo `(app)` (chama
`/usuarios/eu` e redireciona em 401) e o proxy (401 → limpa sessão).

---

## 5. Modelo de autorização

O backend tem **duas camadas independentes**; o frontend precisa espelhar as duas.

### Camada 1 — perfil global (`PerfilGuard`)

`@Perfis(ALUNO)` / `@Perfis(PROFESSOR)`. Passa quem tiver **qualquer** um dos perfis
exigidos. Perfis são **derivados** da existência de linha em `alunos`/`professores` —
**o mesmo usuário pode ser ALUNO e PROFESSOR ao mesmo tempo** (D-12 em aberto). O frontend
precisa tratar `perfis: string[]`, nunca `perfil: string`.

### Camada 2 — participação contextual (`ParticipacaoGuard`)

Roda em rotas com `:monitoriaId` e resolve o `ContextoParticipacao`:
`{ monitoria, ehProfessorResponsavel, participacao, papel }`.

O decorator aceita `papeis[]` e uma política para o professor responsável:

| Política | Significado | Onde aparece |
|---|---|---|
| `PERMITIDO` (padrão) | passa mesmo sem papel de participante | leituras, materiais |
| `EXIGIDO` | **só** ele passa | habilitar monitor/monitorado, analytics de monitores |
| `NEGADO` | ele **não** passa | disponibilidades, agendar atendimento |

`NEGADO` é a regra mais fácil de errar na UI: o professor administra a monitoria mas
**não tem agenda** — não declara disponibilidade nem agenda atendimento, porque não possui
vínculo que ocupe horário.

### Camada 3 — propriedade, verificada no service

Nenhum guard alcança: só o **autor** edita o material; só o **monitor da sessão** (ou o
professor responsável) realiza/cancela aquele atendimento; só o **dono** desativa a própria
disponibilidade; só o **próprio inscrito** avalia.

---

## 6. Mapa API → frontend

Legenda: `pub` público · `auth` autenticado · `PROF`/`ALU` perfil · `resp` professor
responsável · `part` participante ativo ou responsável · `MON`/`MTD` papel na monitoria.

### Autenticação e conta

| Método | Rota | Acesso | Payload | Resposta | Tela/feature |
|---|---|---|---|---|---|
| GET | `/api/configuracao` | **pub** | — | `{fusoHorario, agendamento:{duracaoMinimaMinutos,duracaoMaximaMinutos,antecedenciaMinimaMinutos,cancelamentoAntecedenciaMinutos}}` | **Boot do app** — fuso e limites de formulário |
| POST | `/api/auth/registro/aluno` | pub (10/min) | `{nome,email,senha,matricula,curso?}` | `UsuarioResposta` | Cadastro de aluno |
| POST | `/api/auth/registro/professor` | pub (10/min) | `{nome,email,senha,identificacaoFuncional?,departamento?,codigoCadastro?}` | `UsuarioResposta` | Cadastro de professor |
| POST | `/api/auth/login` | pub (**5/min**) | `{email,senha}` | `{tokenDeAcesso,tipoToken,expiraEm⚠,expiraEmSegundos,expiraEmIso,usuario}` | Login |
| GET | `/api/usuarios/eu` | auth | — | `UsuarioResposta` | **Bootstrap de sessão** |
| PATCH | `/api/usuarios/eu` | auth | `{nome?}` | `UsuarioResposta` | Perfil |
| PATCH | `/api/usuarios/eu/senha` | auth | `{senhaAtual,novaSenha}` | 204 | Perfil › segurança |
| GET | `/api/alunos` | PROF | `?busca=` (nome/matrícula/e-mail) · `?semVinculoAtivoNaMonitoria=<uuid>` · paginação | paginada | **Habilitar monitor** — usar os dois filtros juntos evita 409 de RN09 previsível |
| GET | `/api/alunos/:usuarioId` | PROF ou o próprio | — | `UsuarioResposta` | Detalhe de aluno |
| PATCH | `/api/alunos/eu` | ALU | `{curso?}` | `UsuarioResposta` | Perfil do aluno |
| GET | `/api/professores` | auth | paginação | paginada | Descoberta de docentes |
| GET | `/api/professores/:usuarioId` | auth | — | `UsuarioResposta` | Detalhe |
| PATCH | `/api/professores/eu` | PROF | `{departamento?}` | `UsuarioResposta` | Perfil do professor |

### Disciplinas

| Método | Rota | Acesso | Payload | Tela |
|---|---|---|---|---|
| POST | `/api/disciplinas` | PROF | `{codigo,nome}` | Catálogo › nova disciplina |
| GET | `/api/disciplinas` | auth | `?busca&ativa&pagina&limite` | Catálogo; **combobox de criar monitoria** |
| GET | `/api/disciplinas/:id` | auth | — | Detalhe |
| PATCH | `/api/disciplinas/:id` | PROF | `{nome?,ativa?}` | Editar disciplina |

### Monitorias

| Método | Rota | Acesso | Payload | Resposta | Tela |
|---|---|---|---|---|---|
| POST | `/api/monitorias` | PROF | `{disciplinaId,ano,semestre,descricao?,dataInicio?,dataFim?}` | `MonitoriaResposta` | Criar monitoria |
| GET | `/api/monitorias` | auth | `?busca` (código/nome da disciplina, nome do professor) `&disciplinaId&professorId&ano&semestre&status` | paginada | **Explorar monitorias** (aluno) |
| GET | `/api/monitorias/minhas` | auth | `?status[]&ano&semestre&pagina&limite` — **default: só PLANEJADA+ATIVA** | **paginada** (`{dados,meta}`) com `meuPapel`/`souResponsavel`/`meuParticipanteId` | **Dashboard**. Para histórico, pedir `?status=ENCERRADA&status=CANCELADA` |
| GET | `/api/monitorias/:monitoriaId` | auth | — | `MonitoriaResposta` + `meuPapel`, `souResponsavel`, **`meuParticipanteId`** | **Layout da monitoria** (define a UI inteira) |
| PATCH | `/api/monitorias/:monitoriaId` | resp | `{descricao?,dataInicio?,dataFim?}` | | Editar monitoria |
| POST | `/api/monitorias/:id/ativar` | resp | — | | Ação de status |
| POST | `/api/monitorias/:id/encerrar` | resp | — | | Ação de status (409 se houver AGENDADOS) |
| POST | `/api/monitorias/:id/cancelar` | resp | `{motivo}` (5–500) | | Ação de status |

### Participantes

| Método | Rota | Acesso | Payload | Tela |
|---|---|---|---|---|
| POST | `/api/monitorias/:id/monitores` | resp (`EXIGIDO`) | `{alunoId}` ← **id do usuário** | Participantes › habilitar monitor (RN01) |
| POST | `/api/monitorias/:id/monitorados` | resp (`EXIGIDO`) | `{alunoId}` | Participantes › inscrever aluno |
| POST | `/api/monitorias/:id/inscricao` | ALU | — | **Botão "Participar"** (auto-inscrição) |
| GET | `/api/monitorias/:id/participantes` | part | `?papel&status&pagina&limite` | Lista; **seleção de monitor ao agendar** |
| POST | `/api/monitorias/:id/participantes/:participanteId/encerrar` | resp ou o próprio | — | Encerrar vínculo / "sair da monitoria" |

### Disponibilidades

| Método | Rota | Acesso | Payload | Tela |
|---|---|---|---|---|
| POST | `/api/monitorias/:id/disponibilidades` | **MON** (prof `NEGADO`) | `{diaSemana:0..6,horaInicio:"HH:MM",horaFim}` | Minha agenda semanal |
| GET | `/api/monitorias/:id/disponibilidades` | **auth** (qualquer autenticado) | `?participanteId&ativa` → **array cru** | **Vitrine de horários — visível antes de se inscrever**; passo 1 do agendamento |
| POST | `/api/monitorias/:id/disponibilidades/:dispId/desativar` | **MON dono** | — | Minha agenda semanal |

### Atendimentos

| Método | Rota | Acesso | Payload | Tela |
|---|---|---|---|---|
| POST | `/api/monitorias/:id/atendimentos` | **MON ou MTD** (prof `NEGADO`) | `{monitorParticipanteId?,inicio,fim,assunto,modalidade,local?,vagas?}` | **Abrir sessão** (monitor) / **Solicitar atendimento** (monitorado) |
| GET | `/api/monitorias/:id/atendimentos` | part | `?status&de&ate&monitorParticipanteId` `&aceitandoInscricao&ordenarPor&direcao` | Agenda da monitoria |
| GET | `/api/atendimentos/meus` | auth | idem | **Meus atendimentos** — já traz `monitoria{periodo,codigoDisciplina,nomeDisciplina}`, sem N+1 |
| GET | `/api/atendimentos/:id` | part | — | Detalhe (traz `inscricoes` **e** `historico`) |
| GET | `/api/atendimentos/:id/historico` | part | — | Aba de auditoria (RN10) — inclui **reagendamentos** |
| POST | `/api/atendimentos/:id/inscricao` | **MTD** | — | "Inscrever-se" — habilitar pelo campo `aceitaInscricao` |
| POST | `/api/atendimentos/:id/inscricao/cancelar` | **MTD** | — | "Desistir" |
| POST | `/api/atendimentos/:id/reagendar` | monitor da sessão ou resp | `{inicio,fim,motivo}` | **Reagendar** — revalida duração e janela; 409 lista os inscritos que conflitam |
| POST | `/api/atendimentos/:id/realizar` | monitor da sessão ou resp | `{ausentes?: string[]}` ← **ids de inscrição** | **Registrar presença** |
| POST | `/api/atendimentos/:id/cancelar` | monitor da sessão ou resp | `{motivo}` (5–500) | Cancelar sessão |

`monitorParticipanteId` é obrigatório quando quem agenda é MONITORADO; é **ignorado** quando
o próprio monitor abre a sessão (ele nunca agenda em nome de outro).

**Campos calculados no servidor** (não reimplemente no cliente):

- `aceitaInscricao: boolean` — `AGENDADO && vagasOcupadas < vagas && inicio > agora`, avaliado
  no **relógio do servidor**. É o que habilita o botão "Inscrever-se".
- `monitoria: { id, periodo, codigoDisciplina, nomeDisciplina }` — presente em **todas** as
  rotas de atendimento (o service inclui `INCLUDE_MONITORIA` em todos os caminhos).
- Em `inscricoes[]`, **apenas a inscrição do requisitante** recebe `souEu: true`,
  `jaAvaliei` e `podeAvaliar`. Nas dos colegas os campos vêm ausentes — o anonimato da
  avaliação (D-10) continua preservado. Também populado nas **listagens**, não só no detalhe.

### Avaliações

| Método | Rota | Acesso | Payload | Tela |
|---|---|---|---|---|
| POST | `/api/atendimentos/:id/avaliacao` | MTD **com presença** | `{nota:1..5,comentario?}` | Modal "Avaliar atendimento" |
| GET | `/api/atendimentos/:id/avaliacoes` | part | — → `{total,media,avaliacoes[]}` | Detalhe do atendimento |
| GET | `/api/monitorias/:mid/monitores/:participanteId/avaliacoes` | part | — → resumo | Perfil do monitor / indicadores |

Autoria **nunca** é exposta na resposta (decisão D-10).

### Materiais

| Método | Rota | Acesso | Payload | Tela |
|---|---|---|---|---|
| POST | `/api/monitorias/:id/materiais` | **MON** ou resp | `{titulo,descricao?,url}` | Publicar material (RN08) |
| GET | `/api/monitorias/:id/materiais` | part | `?pagina&limite&incluirRemovidos` | Acervo (RN07) |
| GET | `/api/monitorias/:id/materiais/:materialId` | part | — | Detalhe |
| PATCH | `/api/monitorias/:id/materiais/:materialId` | autor ou resp | `{titulo?,descricao?,url?}` | Editar |
| POST | `/api/monitorias/:id/materiais/:materialId/remover` | autor ou resp | — | Remover (soft delete) |

### Gamificação e indicadores

| Método | Rota | Acesso | Tela |
|---|---|---|---|
| GET | `/api/gamificacao/ranking` | auth | `?monitoriaId&limite` → array — Ranking |
| GET | `/api/gamificacao/meus-pontos` | auth | `?monitoriaId` → `{total,porTipo,ultimosEventos}` — Meus pontos |
| GET | `/api/analytics/resumo` | **PROF** | `?apenasMinhas` — Dashboard do professor |
| GET | `/api/analytics/monitorias/:monitoriaId` | part | — Aba "Indicadores" da monitoria |
| GET | `/api/analytics/monitorias/:monitoriaId/monitores` | resp (`EXIGIDO`) | → array — Desempenho por monitor |

### Telas que precisam de mais de um endpoint

| Tela | Endpoints |
|---|---|
| Layout de monitoria | `GET /monitorias/:id` (contexto) + o recurso da aba |
| Solicitar atendimento (aluno) | `GET /participantes?papel=MONITOR` + `GET /disponibilidades` + `POST /atendimentos` |
| Detalhe de atendimento | `GET /atendimentos/:id` + `GET /:id/avaliacoes` |
| Gerenciar participantes | `GET /participantes?status=ATIVO` + `?status=ENCERRADO` + `GET /alunos` |
| Dashboard do professor | `GET /analytics/resumo?apenasMinhas=true` + `GET /monitorias/minhas` |
| Dashboard do aluno | `GET /monitorias/minhas` + `GET /atendimentos/meus?status=AGENDADO` + `GET /gamificacao/meus-pontos` |
| Indicadores da monitoria | `GET /analytics/monitorias/:id` (+ `/monitores` se responsável) |

### Endpoints sem tela própria

`GET /professores/:usuarioId`, `PATCH /disciplinas/:id`, `?incluirRemovidos=true`,
`?status=ENCERRADO`, `GET /atendimentos/:id/historico` — entram como recursos secundários
(detalhe, aba "histórico", toggle "mostrar removidos"), não como telas dedicadas.

---

## 7. Arquitetura proposta para o Next.js

### 7.1 Princípios

1. **App Router com Server Components por padrão.** Listagens e detalhes são buscados no
   servidor (sem token no cliente, sem waterfall de carregamento). `"use client"` só onde
   há interação: formulários, modais, filtros, tabelas.
2. **Feature-based, não layer-based.** Cada feature (`monitorias`, `atendimentos`, …)
   possui `api/`, `schemas/`, `hooks/`, `components/`, `types/`. Layer-based
   (`/components`, `/hooks`, `/services` globais) espalha uma mudança de contrato por
   quatro pastas.
3. **Uma feature = um módulo do backend.** O alinhamento 1:1 mantém o rastro entre
   contrato e consumo, o que é defensável na banca.
4. **Camada de API isolada e única.** Nenhum componente chama `fetch` diretamente. Todo
   acesso passa por `lib/api/http.ts`, que centraliza baseURL, cookie/Bearer, tradução de
   erro e o `unwrap` de `{dados, meta}`.
5. **Autorização como dado, não como `if` espalhado.** Um único módulo
   (`lib/autorizacao/capacidades.ts`) traduz `{perfis, meuPapel, souResponsavel, status}`
   em booleanos nomeados. Toda a UI consome esses booleanos. Espelha a tabela do backend
   em um lugar só — e mudar uma regra é mudar uma linha.
6. **Nada de complexidade que o escopo não pague.** Sem Redux/Zustand, sem monorepo, sem
   micro-frontends, sem camada de repositório, sem DI. TanStack Query já é o cache; o
   App Router já é o roteamento; o backend já é a autoridade.

### 7.2 Fluxo de dados

```
Server Component  ──► lib/api/servidor.ts ──(cookie httpOnly → Bearer)──► NestJS
       │ hidrata
       ▼
Client Component  ──► TanStack Query ──► /api/backend/[...path] (proxy) ──► NestJS
```

Leitura inicial: RSC (rápida, sem flash de loading). Interação e revalidação: TanStack
Query pelo proxy. Mutações: `useMutation` + `invalidateQueries`, ou Server Action +
`revalidatePath` quando a tela for inteiramente server-side.

---

## 8. Estrutura de pastas proposta

```
frontend/
├── docs/
│   └── analise-e-arquitetura-frontend.md      # este documento
├── src/
│   ├── app/
│   │   ├── layout.tsx                          # html, providers globais, fontes
│   │   ├── (publico)/
│   │   │   ├── layout.tsx                      # layout enxuto, sem nav
│   │   │   ├── login/page.tsx
│   │   │   └── cadastro/{aluno,professor}/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx                      # exige sessão (GET /usuarios/eu), shell + nav
│   │   │   ├── inicio/page.tsx                 # dashboard (ramifica por perfil)
│   │   │   ├── monitorias/
│   │   │   │   ├── page.tsx                    # explorar (catálogo)
│   │   │   │   ├── nova/page.tsx               # PROFESSOR
│   │   │   │   └── [monitoriaId]/
│   │   │   │       ├── layout.tsx              # ← resolve o CONTEXTO; monta as abas
│   │   │   │       ├── page.tsx                # visão geral
│   │   │   │       ├── participantes/page.tsx
│   │   │   │       ├── disponibilidades/page.tsx
│   │   │   │       ├── atendimentos/page.tsx
│   │   │   │       ├── materiais/page.tsx
│   │   │   │       └── indicadores/page.tsx
│   │   │   ├── atendimentos/
│   │   │   │   ├── page.tsx                    # meus atendimentos
│   │   │   │   └── [atendimentoId]/page.tsx
│   │   │   ├── disciplinas/page.tsx            # PROFESSOR
│   │   │   ├── ranking/page.tsx
│   │   │   └── conta/page.tsx
│   │   └── api/
│   │       ├── bff/{login,logout}/route.ts     # grava/apaga o cookie httpOnly
│   │       └── backend/[...path]/route.ts      # proxy autenticado
│   │
│   ├── features/
│   │   ├── auth/          { api, schemas, hooks, components }
│   │   ├── usuarios/
│   │   ├── disciplinas/
│   │   ├── monitorias/    # inclui participantes (sub-recurso, como no backend)
│   │   ├── disponibilidades/
│   │   ├── atendimentos/  # inclui inscrições e presença
│   │   ├── avaliacoes/
│   │   ├── materiais/
│   │   ├── gamificacao/
│   │   └── analytics/
│   │
│   ├── components/
│   │   ├── ui/                                 # shadcn/ui (button, dialog, table…)
│   │   ├── layout/                             # AppShell, Sidebar, Header, UserMenu
│   │   └── comum/                              # EstadoVazio, Paginacao, ErroInline,
│   │                                           # BadgeStatus, BadgePapel, Skeletons
│   ├── lib/
│   │   ├── api/
│   │   │   ├── http.ts                         # fetch tipado + ApiError
│   │   │   ├── servidor.ts                     # variante RSC/Server Action (lê cookie)
│   │   │   ├── cliente.ts                      # variante browser (via proxy)
│   │   │   └── erros.ts                        # ApiError, mapearErroDeFormulario
│   │   ├── auth/
│   │   │   ├── sessao.ts                       # obterSessao(), exigirSessao()
│   │   │   └── cookie.ts                       # nome, flags, maxAge a partir do `exp`
│   │   ├── autorizacao/
│   │   │   └── capacidades.ts                  # ← ESPELHO ÚNICO das regras do backend
│   │   ├── datas/
│   │   │   └── fuso.ts                         # TZ da instituição; ISO ⇄ local
│   │   ├── query/
│   │   │   ├── chaves.ts                       # query keys centralizadas
│   │   │   └── provider.tsx
│   │   └── utils.ts
│   │
│   ├── types/
│   │   ├── api.ts                              # RespostaPaginada<T>, RespostaErro
│   │   └── dominio.ts                          # enums + DTOs espelhando o backend
│   │
│   ├── config/
│   │   ├── env.ts                              # validação de env com Zod
│   │   └── navegacao.ts                        # itens de menu + capacidade exigida
│   └── middleware.ts
├── .env.example
└── package.json
```

Regra de organização: **tipo/schema/chamada de API moram na feature dona**; só o que é
genuinamente transversal desce para `lib/` ou `components/comum/`.

---

## 9. Stack recomendada

| Biblioteca | Papel | Justificativa |
|---|---|---|
| **Next.js 15 (App Router)** | framework | RSC permite buscar dados no servidor com o cookie httpOnly, sem expor o token; layouts aninhados casam com `/monitorias/[id]/*`, onde o contexto é resolvido uma vez e herdado pelas abas |
| **TypeScript (strict)** | tipos | o backend tem 10 enums e ~20 DTOs; sem tipos, o risco `alunoId` × `participanteId` vira bug de produção |
| **Tailwind CSS** | estilo | responsividade utilitária sem CSS paralelo; sem runtime |
| **shadcn/ui (Radix)** | componentes | **código no repositório, não dependência** — acessibilidade (foco, ARIA, teclado) pronta em dialog/select/tabs, que este app usa muito. Alternativa MUI foi descartada: tema pesado e menos alinhado a Tailwind |
| **TanStack Query v5** | server state | cache, revalidação, `isPending`, retry e invalidação após mutação. Substitui integralmente um store global — os dados são do servidor, não do cliente |
| **React Hook Form** | formulários | validação sem re-render a cada tecla; ~10 formulários no escopo |
| **Zod** | schemas | **um schema por DTO, espelhando os limites do `class-validator`** (nota 1–5, motivo 5–500, senha 8–128, assunto 3–200…). Também valida env |
| **@hookform/resolvers** | ponte | liga Zod ao RHF |
| **date-fns + @date-fns/tz** | datas | atendimento é `TIMESTAMPTZ` e disponibilidade é hora local no fuso da instituição; precisa de conversão explícita por fuso, não do fuso do navegador |
| **lucide-react** | ícones | leve, tree-shakeable, é o padrão do shadcn/ui |
| **sonner** | toasts | feedback de mutação (padrão do shadcn/ui) |
| **TanStack Table** | tabelas | **somente** em participantes e desempenho de monitores, onde há ordenação client-side. Nas demais listas, `<table>` simples |
| **recharts** | gráficos | apenas nas telas de indicadores; `porStatus` já vem no formato de gráfico |

**Deliberadamente fora:** Redux/Zustand/Jotai (não há estado global do cliente — sessão é
cookie + RSC, e o resto é server state), Axios (`fetch` nativo basta e integra com o cache
do Next), NextAuth (o backend não é OAuth/OIDC; seria uma camada a mais para um login
local por e-mail e senha), i18n (aplicação monolíngue), Storybook (não paga o custo neste
escopo).

**Geração de tipos a partir do OpenAPI:** o Swagger existe em `/docs`. Vale rodar
`openapi-typescript` **como script pontual** para conferir os tipos escritos à mão contra o
contrato — não como dependência de build, porque os DTOs de resposta usam `RespostaPaginada`
genérica, que o Swagger do Nest não infere bem.

---

## 10. Estratégia de gerenciamento de estado

Quatro categorias, quatro mecanismos — nenhum store global:

| Estado | Mecanismo | Motivo |
|---|---|---|
| **Server state** (monitorias, atendimentos, materiais…) | TanStack Query + RSC | é cache de dado remoto, não estado da aplicação |
| **Sessão** | cookie httpOnly + `GET /usuarios/eu` em RSC, exposto por `<SessaoProvider>` para o cliente | única fonte confiável; sem duplicação |
| **Contexto da monitoria** (`meuPapel`, `souResponsavel`, `status`) | resolvido no `layout.tsx` de `[monitoriaId]` e exposto por `<MonitoriaProvider>` | é a chave de toda a autorização de UI; buscar uma vez por rota evita N chamadas |
| **Estado de UI** (filtros, paginação, aba ativa, modal aberto) | **URL** (`searchParams`) e `useState` local | filtro na URL torna a tela compartilhável, recarregável e navegável pelo botão "voltar" |

---

## 11. Estratégia de cache / server state

- **Query keys centralizadas** em `lib/query/chaves.ts`, hierárquicas:
  `['monitorias']`, `['monitorias', id]`, `['monitorias', id, 'participantes', filtro]`.
  Invalidação por prefixo passa a ser uma linha.
- **Defaults:** `staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: false`,
  `retry: (n, erro) => erro.statusCode >= 500 && n < 2`.
  **Nunca repetir 4xx** — retry em 401/403/409 é ruído, e retry em 429 piora o rate limit.
- **Dados quase estáticos** (`/disciplinas`, `/professores`): `staleTime: 5min`.
- **Após mutação, invalidar o mínimo correto.** Exemplos que o domínio exige:
  - `POST /atendimentos/:id/realizar` → invalida o atendimento, a agenda da monitoria,
    `atendimentos/meus`, os indicadores **e** a gamificação (pontos são concedidos por evento).
  - `POST /monitorias/:id/encerrar` → invalida a monitoria, `monitorias/minhas` e participantes
    (todos os vínculos passam a ENCERRADO em cascata **no service**).
  - `POST /monitorias/:id/inscricao` → invalida a monitoria (o `meuPapel` muda!),
    `monitorias/minhas` e participantes.
- **Sem atualização otimista** nas ações de domínio. Praticamente toda mutação pode ser
  rejeitada por uma constraint que só o banco conhece (conflito de horário, vaga esgotada,
  RN09). Fingir sucesso e desfazer é pior UX do que um botão em `pending` por 300 ms.
  Otimismo fica reservado a alternâncias triviais, se surgirem.
- **Paginação:** `placeholderData: keepPreviousData` para a lista não piscar ao trocar de página.

---

## 12. Estratégia de formulários

- **RHF + Zod**, com `mode: 'onBlur'` e `reValidateMode: 'onChange'`.
- **Um schema por DTO de entrada**, em `features/<x>/schemas/`, replicando exatamente os
  limites do `class-validator` — inclusive normalizações que o backend aplica
  (`trim`, e-mail em minúsculas, código de disciplina em maiúsculas). Divergir aqui produz
  o pior tipo de bug: o formulário aprova e a API rejeita.
- **Erros do servidor voltam para os campos.** `detalhes[]` chega como
  `"email deve ser um endereco de e-mail valido"`; um utilitário
  `mapearErroDeFormulario(erro, setError)` extrai o nome do campo do prefixo da mensagem
  e o que sobrar vira erro de formulário (`root`). Nada de 400 exibido só como toast.
- **409 é regra de negócio, não erro de campo** → alerta no topo do formulário, com a
  `mensagem` do backend (já escrita para o usuário final).
- **Formulários com regra temporal** (agendar atendimento) validam no cliente o que o
  backend valida — futuro, `fim > inicio`, 15–240 min — para dar feedback imediato; o
  backend continua sendo a autoridade.
- **`vagas`** só aparece quando quem agenda é MONITOR; para MONITORADO o campo
  `monitorParticipanteId` é obrigatório. Um único componente com duas variantes de schema
  (união discriminada pelo papel), não duas telas.

---

## 13. Estratégia de tratamento de erros

Classe única `ApiError` carregando `statusCode`, `erro`, `mensagem`, `detalhes`, `caminho`.
Toda resposta não-ok vira `ApiError` em `lib/api/http.ts`. Política por status:

| Status | Significado no domínio | Tratamento |
|---|---|---|
| **400** | validação | erros nos campos via `detalhes[]`; alerta no formulário |
| **401** | sessão expirada/inválida | limpar cookie e redirecionar para `/login?expirou=1` |
| **403** | perfil, participação ou propriedade insuficiente | página/estado "sem acesso" com a `mensagem`; **nunca** aparecer para o usuário se a UI estiver correta — logar como sintoma de divergência entre `capacidades.ts` e o backend |
| **404** | recurso inexistente ou fora do contexto | `notFound()` do Next |
| **409** | **conflito de domínio** (RN03, RN09, transição inválida, sem vagas…) | alerta ou toast com a `mensagem` do backend, sem reescrever o texto |
| **429** | rate limit (login!) | mensagem específica: "muitas tentativas, aguarde um minuto" |
| **5xx** | falha do servidor | mensagem genérica + botão "tentar novamente"; nunca expor detalhe interno |

`error.tsx` por segmento de rota (não só um global), `not-found.tsx`, e um
`<ErroInline>` reutilizável para falhas dentro de uma aba, para que o resto da tela
continue utilizável.

**409 é cidadão de primeira classe nesta aplicação**, não um caso de borda: as regras mais
importantes do sistema só se manifestam como conflito no momento da escrita.

---

## 14. Estratégia de loading states

- **`loading.tsx` por segmento**, com skeleton que reproduz o layout final (mesma altura e
  colunas) — evita salto de layout.
- **Suspense granular** dentro da página: o cabeçalho da monitoria renderiza imediatamente
  (vem do layout) enquanto a lista da aba carrega.
- **Mutações:** botão em estado `pending` com spinner e texto ("Salvando…"), **desabilitado**
  para impedir duplo envio — importante em `POST /inscricao`, onde o segundo clique
  produziria 409.
- **Estados vazios explícitos e acionáveis**: "Nenhum monitor habilitado ainda" +
  botão "Habilitar monitor" (se a capacidade permitir), em vez de tabela vazia.
- **Sem spinner de página inteira** depois do primeiro carregamento — as revalidações do
  TanStack Query são silenciosas, com um indicador discreto de "atualizando".

---

## 15. Estratégia de responsividade

- **Mobile-first**, breakpoints padrão do Tailwind (`sm 640 / md 768 / lg 1024 / xl 1280`).
- **Navegação:** sidebar fixa em `lg+`; `Sheet` lateral em `< lg`; ações principais em
  barra inferior no mobile.
- **Tabelas viram cartões** abaixo de `md` (participantes, atendimentos, materiais). Um
  componente `<ListaResponsiva>` recebe as colunas e a função de renderizar o cartão — a
  transformação acontece em um lugar só.
- **Agenda semanal de disponibilidade:** grade de 7 colunas em desktop; lista agrupada por
  dia no mobile. Grade de 7 colunas em 375 px é ilegível.
- **Formulários:** uma coluna no mobile, duas em `md+`. Seletor de data/hora nativo em
  mobile, componente em desktop.
- **Alvos de toque ≥ 44 px**, e nenhuma ação disponível só no `hover`.
- **Fuso horário é parte da responsividade de conteúdo:** todo horário exibido carrega o
  fuso da instituição, porque o backend valida a disponibilidade nesse fuso e o aluno pode
  estar com o dispositivo em outro.

---

## 16. Estratégia de autorização no frontend

**Premissa registrada: a autorização real é do backend.** Guards globais, `ParticipacaoGuard`
e as constraints continuam valendo mesmo que o frontend seja adulterado. O que segue é
**UX**: não oferecer ao usuário uma ação que ele receberia 403 ao tentar.

Um módulo único, `lib/autorizacao/capacidades.ts`, espelha a tabela do backend:

```ts
export type ContextoAutorizacao = {
  perfis: PerfilUsuario[];
  meuPapel: PapelMonitoria | null;
  souResponsavel: boolean;
  statusMonitoria: StatusMonitoria;
};

export function capacidades(c: ContextoAutorizacao) {
  const ativa   = c.statusMonitoria === 'ATIVA';
  const aberta  = c.statusMonitoria !== 'ENCERRADA' && c.statusMonitoria !== 'CANCELADA';
  const monitor = c.meuPapel === 'MONITOR';
  const mtd     = c.meuPapel === 'MONITORADO';
  const participa = monitor || mtd;

  return {
    verMonitoria:          participa || c.souResponsavel,             // RN07
    administrarMonitoria:  c.souResponsavel,
    habilitarMonitor:      c.souResponsavel && aberta,                // RN01 (EXIGIDO)
    declararDisponibilidade: monitor && aberta,                       // professor NEGADO
    agendarAtendimento:    participa && ativa,                        // professor NEGADO
    inscreverEmSessao:     mtd && ativa,
    registrarPresenca:     monitor || c.souResponsavel,               // + ser o monitor da sessão
    publicarMaterial:      (monitor || c.souResponsavel) && aberta,   // RN08
    avaliarAtendimento:    mtd,                                       // + REALIZADO e PRESENTE
    verIndicadores:        participa || c.souResponsavel,
    verDesempenhoMonitores: c.souResponsavel,                         // EXIGIDO
  };
}
```

Regras que dependem do **recurso**, não só do contexto, ficam em predicados próprios ao
lado desse arquivo — porque a decisão é por item da lista:

```ts
podeEditarMaterial(material, sessao, ctx) // autor OU professor responsável, e não removido
podeGerirAtendimento(atendimento, ctx)    // é o monitor DAQUELA sessão OU o responsável
podeAvaliar(atendimento, inscricao)       // REALIZADO && inscricao.status === 'PRESENTE'
podeInscrever(atendimento)                // AGENDADO && vagasOcupadas < vagas && inicio > agora
```

Aplicação em três lugares, todos alimentados pelo mesmo módulo:

1. **Navegação** — `config/navegacao.ts` associa cada item à capacidade exigida.
2. **Rota** — o `layout.tsx` de `[monitoriaId]` redireciona quem não tem `verMonitoria`
   (o backend já devolveria 403; a UI evita a tela quebrada).
3. **Componente** — botões e menus consultam `capacidades()`; nunca um `if (perfil === …)`
   solto no meio do JSX.

**Regra de disciplina:** nenhuma verificação de papel fora de `lib/autorizacao/`. Se
aparecer `meuPapel === 'MONITOR'` dentro de um componente, é para virar capacidade nomeada.

---

## 17. Fluxos do Professor (confirmados contra o backend)

```
Login (POST /auth/login → cookie)
  └─► Dashboard  (GET /monitorias/minhas + GET /analytics/resumo?apenasMinhas=true)
        ├─► Disciplinas         (GET/POST/PATCH /disciplinas)          [pré-requisito]
        ├─► Criar monitoria     (POST /monitorias) → nasce PLANEJADA
        │      └─► Ativar       (POST /:id/ativar) ← sem isso, ninguém agenda
        └─► Monitoria [id]      (GET /monitorias/:id → souResponsavel = true)
              ├─ Participantes  GET /participantes
              │     ├─ Habilitar monitor    POST /monitores    {alunoId}   (RN01)
              │     ├─ Inscrever monitorado POST /monitorados  {alunoId}
              │     ├─ Histórico            GET /participantes?status=ENCERRADO
              │     └─ Encerrar vínculo     POST /participantes/:pid/encerrar
              ├─ Atendimentos   GET /monitorias/:id/atendimentos
              │     ├─ (NÃO agenda — professor é NEGADO na criação)
              │     ├─ Realizar   POST /atendimentos/:id/realizar {ausentes}
              │     ├─ Cancelar   POST /atendimentos/:id/cancelar {motivo}
              │     └─ Histórico  GET /atendimentos/:id/historico
              ├─ Materiais      GET / POST / PATCH / :id/remover           (RN08)
              ├─ Indicadores    GET /analytics/monitorias/:id
              │     └─ Por monitor  GET /analytics/monitorias/:id/monitores
              ├─ Avaliações     GET /monitorias/:id/monitores/:pid/avaliacoes
              └─ Encerrar/Cancelar monitoria  POST /encerrar | /cancelar {motivo}
                    ⚠ 409 se houver atendimentos AGENDADOS → a UI deve listá-los
                       e oferecer o cancelamento de cada um antes.
```

**Não existe para o professor:** declarar disponibilidade, agendar atendimento, inscrever-se
em sessão, avaliar. Todos negados pelo backend — a UI simplesmente não exibe.

## 18. Fluxos do Aluno (confirmados contra o backend)

```
Login
  └─► Dashboard  (GET /monitorias/minhas + /atendimentos/meus?status=AGENDADO
                  + /gamificacao/meus-pontos)
        ├─► Explorar monitorias      GET /monitorias?status=ATIVA
        │      └─ Participar          POST /monitorias/:id/inscricao  → papel MONITORADO
        │           ⚠ 409 se já houver vínculo ativo (RN09)
        └─► Monitoria [id]  (GET /monitorias/:id → meuPapel decide TUDO abaixo)
              │
              ├── meuPapel = MONITOR
              │     ├─ Disponibilidades   POST/GET/:id/desativar
              │     ├─ Abrir sessão       POST /atendimentos (origem OFERTA_MONITOR, vagas ≥ 1)
              │     ├─ Registrar presença POST /atendimentos/:id/realizar {ausentes}
              │     ├─ Cancelar sessão    POST /atendimentos/:id/cancelar {motivo}
              │     ├─ Publicar material  POST /materiais                        (RN08)
              │     └─ Minhas avaliações  GET /monitorias/:id/monitores/:meuPid/avaliacoes
              │
              └── meuPapel = MONITORADO
                    ├─ Ver monitores      GET /participantes?papel=MONITOR
                    ├─ Ver horários       GET /disponibilidades
                    ├─ Solicitar          POST /atendimentos {monitorParticipanteId, …}
                    │                       origem SOLICITACAO_ALUNO; já cria a inscrição
                    ├─ Entrar em sessão   POST /atendimentos/:id/inscricao
                    ├─ Desistir           POST /atendimentos/:id/inscricao/cancelar
                    │                       ⚠ se era o solicitante e ficou vazio → sessão cancelada
                    ├─ Avaliar            POST /atendimentos/:id/avaliacao {nota, comentario?}
                    │                       só com REALIZADO + PRESENTE          (RN05/RN06)
                    └─ Materiais          GET /materiais (somente leitura)       (RN07)
        │
        ├─► Meus atendimentos   GET /atendimentos/meus  (todas as monitorias, todos os status)
        └─► Gamificação         GET /gamificacao/meus-pontos + /ranking
```

**O ponto do TCC que a UI precisa evidenciar:** `GET /monitorias/minhas` devolve
`meuPapel` por monitoria. A tela deve mostrar, lado a lado, o mesmo aluno como **MONITOR**
em uma monitoria e **MONITORADO** em outra — é a demonstração visual da modelagem.

---

## 19. Gaps e inconsistências encontrados no backend

> **Status em 2026-09-08:** dos 26 itens levantados, **17 foram corrigidos** no backend,
> 1 foi parcialmente atendido por decisão justificada, 5 permanecem como escopo declarado
> e 3 continuam abertos como decisão de produto. A tabela de status abaixo é a leitura
> rápida; o histórico completo do diagnóstico fica preservado nas subseções seguintes,
> porque faz parte do registro do TCC.

### 19.0 Status atual

| Situação | Itens |
|---|---|
| ✅ **Corrigido** | G1 (busca de alunos) · G2 (TTL 8h + `expiraEmSegundos`) · G3 (`jaAvaliei`/`podeAvaliar`) · G4 (disponibilidades liberadas) · G5 (busca de monitorias) · G6 (reagendamento) · G8 (`/minhas` paginado) · G9 (`expiraEm` utilizável) · G10 (**bug** do total de pontos) · G11 (`limite` ignorado) · G18–G22 (documentação) · G23 (`GET /configuracao` expõe o fuso) · G25 (429 documentado) · + `meuParticipanteId`, `monitoria{}`, `aceitaInscricao` |
| 🟡 **Parcial, por decisão** | **G12** — ordenação implementada só em `/monitorias/:id/atendimentos` e `/atendimentos/meus`. Nas outras seis listagens há uma única ordem sensata, e o parâmetro seria superfície de API sem demanda. Limitação registrada no README |
| ⏸️ **Escopo declarado (não fazer)** | G13 (upload) · G14 (ADMIN) · G15 (notificações/chat) · G16 (badges) · G7 (assimetria paginada×array — mantida como decisão consciente para coleções pequenas) |
| 🔵 **Aberto** | G17/C3 (**resolvido de forma mais dura**: o boot agora falha em produção com `CODIGO_CADASTRO_PROFESSOR` vazio) · G24 (CORS — irrelevante sob BFF) · G26 (usuário com dois perfis — segue em aberto no domínio, D-12) |

### 19.1 Diagnóstico original — bloqueadores (histórico)

| # | Achado | Impacto | Contorno no frontend |
|---|---|---|---|
| **G1** | **`GET /alunos` não tem busca** — só paginação (máx. 100/página), ordenada por nome | O fluxo RN01 (professor habilita monitor) exige achar um aluno entre todos. Inviável fora de uma base minúscula | Paginar e filtrar no cliente; documentar como limitação. **Correção sugerida ao backend: `?busca=` em nome/matrícula/e-mail** |
| **G2** | **Não há refresh token nem `/auth/logout`** (D-09 em aberto) | Sessão de 1 h; o usuário é deslogado no meio do trabalho, inclusive com formulário preenchido | Detectar 401, preservar o rascunho do formulário e reautenticar; avisar antes de expirar |
| **G3** | **Não dá para saber se o usuário já avaliou** um atendimento | `AvaliacaoResposta` omite autoria (correto, D-10) e `InscricaoResposta` não tem flag. O botão "Avaliar" só descobre por 409 | Guardar localmente após avaliar; tratar o 409 como sucesso idempotente. **Sugestão: `minhaAvaliacao` ou `jaAvaliei` na inscrição** |
| **G4** | **Disponibilidades exigem participação** | O aluno **não vê os horários antes de entrar** na monitoria; a descoberta fica "entrar primeiro, depois ver" | Deixar isso explícito na UI ("participe para ver os horários") |
| **G5** | **`GET /monitorias` não filtra por texto** — só `disciplinaId` | Busca por "Cálculo" exige dois passos | Buscar em `/disciplinas?busca=` e usar o `disciplinaId` resultante |
| **G6** | **Não existe reagendamento** | O `ON UPDATE CASCADE` e a D-22 preveem o caso, mas nenhuma rota altera `inicio`/`fim` | UI oferece "cancelar e reagendar", com o motivo obrigatório |

### Inconsistências de contrato

| # | Achado | Efeito |
|---|---|---|
| **G7** | **Formato de resposta assimétrico**: uns endpoints devolvem `{dados, meta}`, outros array cru (`/monitorias/minhas`, disponibilidades, histórico, ranking, `/analytics/.../monitores`, avaliações) | O cliente precisa de dois caminhos de desserialização. Isolar em `http.ts` |
| **G8** | **`/monitorias/minhas` não é paginado nem filtrável** | Cresce sem limite ao longo dos semestres; paginar/filtrar no cliente |
| **G9** | **`expiraEm: "1h"`** é a string de configuração, não um instante nem segundos | Para o `maxAge` do cookie, é preciso decodificar o `exp` do JWT |
| **G10** | **`/gamificacao/meus-pontos`: `total` e `porTipo` são somados sobre no máximo os 100 eventos mais recentes** (`limit: 100`), enquanto `/ranking` soma tudo | Um usuário com mais de 100 eventos vê **total menor** no extrato do que no ranking. É a única inconsistência numérica encontrada |
| **G11** | **`FiltroRankingDto.limite` também é aceito em `/meus-pontos`**, onde é ignorado | Parâmetro sem efeito no contrato público |
| **G12** | **Sem ordenação configurável** em nenhum endpoint | Ordenação alternativa só client-side, dentro da página atual |

### Escopo declaradamente ausente

| # | Achado |
|---|---|
| **G13** | **Upload/download de material não existe.** `TipoMaterial.ARQUIVO` e colunas `arquivo_*` estão no schema; nenhum endpoint, nenhum `StorageModule`. A UI não deve oferecer upload |
| **G14** | **Sem perfil ADMIN** e sem gestão de usuários. `usuarios.ativo` é somente leitura pela API — não há como desativar alguém |
| **G15** | **Sem notificações, lista de espera ou chat** (fora de escopo declarado) |
| **G16** | **Sem badges/níveis** — só o livro-razão de pontos e o ranking |
| **G17** | **Cadastro de professor aberto** quando `CODIGO_CADASTRO_PROFESSOR` está vazio (o servidor emite aviso no boot). Vale preencher antes de qualquer demonstração pública |

### Divergências doc × código (o código vence)

| # | Achado |
|---|---|
| **G18** | `docs/arquitetura.md` §10 descreve `infra/storage/`, `StorageModule`, `inscricoes.controller.ts` e `inscricoes.service.ts` — **nenhum existe**. As inscrições foram absorvidas por `AtendimentosService` e viraram rotas `POST /atendimentos/:id/inscricao[/cancelar]` |
| **G19** | O documento cita `CONCLUIDO` em RN06; o enum real é `REALIZADO` |
| **G20** | O documento diz "oferta nasce CONFIRMADO, solicitação nasce SOLICITADO" (D-08); no código **ambas nascem AGENDADO** — a etapa de confirmação foi removida (registrado na revisão 3) |
| **G21** | O documento afirma "Avaliações e materiais permanecem no papel"; **ambos estão implementados**. O cabeçalho está desatualizado; o README está correto |
| **G22** | `docs/arquitetura.md` prevê `test/e2e/`; o que existe é `test/unit/` + `scripts/fluxo-completo.mjs` |

### Pontos de atenção operacional

| # | Achado |
|---|---|
| **G23** | **Fuso horário é crítico.** Atendimento é `TIMESTAMPTZ`; disponibilidade é hora local no `TIMEZONE_INSTITUICAO` (`America/Sao_Paulo`), e a validação de janela é feita em SQL com `AT TIME ZONE`. Se o frontend montar o `inicio` a partir do fuso do navegador, o agendamento será rejeitado sem motivo aparente para o usuário |
| **G24** | **CORS fechado por padrão.** Se `CORS_ORIGINS` estiver vazio, o navegador é bloqueado. Com o padrão BFF isso deixa de importar para o tráfego do browser, mas a variável deve continuar configurada para o Swagger e para depuração |
| **G25** | **Rate limit de 5/min no login** é facilmente atingido em demonstração; a UI precisa de mensagem específica para 429, não "erro desconhecido" |
| **G26** | **Um usuário pode ter os dois perfis** (D-12 em aberto, o schema permite). A navegação precisa acomodar isso — sugestão: menu único com as seções de ambos, em vez de um seletor de "modo" |

---

## 20. Plano de implementação por etapas

Cada etapa entrega algo verificável. Nenhuma etapa começa antes de a anterior estar
integrada ao backend real.

### Etapa 0 — Fundação (sem telas de domínio)
Projeto Next.js 15 + TS strict + Tailwind + shadcn/ui. Porta **3001**. `config/env.ts`
validado com Zod. Estrutura de pastas da seção 8. ESLint/Prettier alinhados ao backend.
`.env.example`. **Critério:** `npm run dev` sobe e o lint passa.

### Etapa 1 — Contrato e camada de API
`types/dominio.ts` (10 enums + DTOs), `types/api.ts`, `lib/api/http.ts` + `ApiError`,
variantes `servidor.ts` e `cliente.ts`, proxy `app/api/backend/[...path]`.
**`lib/config/instituicao.ts`** buscando `GET /api/configuracao` uma vez no boot (fuso +
limites de agendamento), e `lib/datas/fuso.ts` consumindo esse fuso.
Conferência dos tipos contra `/docs-json` — as 9 listagens paginadas agora descrevem `dados`
via `allOf`, então `openapi-typescript` serve como verificação real.
**Critério:** uma chamada tipada a `GET /disciplinas` funciona a partir de um RSC, o erro
401 vira `ApiError`, e o fuso da instituição não aparece hardcoded em lugar nenhum.

### Etapa 2 — Autenticação e shell
Login, cadastro de aluno, cadastro de professor. `POST /bff/login|logout`, cookie httpOnly,
`middleware.ts`, `lib/auth/sessao.ts`, layouts `(publico)` e `(app)`, AppShell responsivo,
menu de usuário, tela de conta (`/usuarios/eu`, troca de senha).
**Critério:** login → dashboard vazio; expiração e logout funcionam; 429 tem mensagem própria.

### Etapa 3 — Autorização e navegação
`lib/autorizacao/capacidades.ts` + predicados por recurso, `config/navegacao.ts`,
`SessaoProvider`, componentes `<BadgePapel>` e `<BadgeStatus>`.
**Critério:** o menu muda conforme o perfil; usuário com dois perfis vê as duas seções.

### Etapa 4 — Disciplinas e monitorias (esqueleto do domínio)
Catálogo de disciplinas (PROFESSOR), explorar monitorias, criar monitoria, layout de
`[monitoriaId]` com o `MonitoriaProvider`, visão geral, ações de status
(ativar/encerrar/cancelar) com o tratamento do 409 de "atendimentos AGENDADOS".
**Critério:** professor cria e ativa uma monitoria; aluno a encontra e se inscreve;
`meuPapel` aparece corretamente para ambos.

### Etapa 5 — Participantes (o núcleo do modelo)
Lista com filtros de papel/status, habilitar monitor, inscrever monitorado, auto-inscrição,
encerrar vínculo, aba de histórico (`status=ENCERRADO`). Tratamento explícito do 409 de RN09.
**Critério:** reproduzir o caso do enunciado — o **mesmo aluno** aparece como MONITOR em uma
monitoria e MONITORADO em outra, visível em `/monitorias/minhas`.

### Etapa 6 — Disponibilidades e atendimentos (a parte mais difícil)
Agenda semanal do monitor (grade em desktop, lista em mobile), criar/desativar faixa.
Agendamento com as duas variantes (monitor abre sessão × monitorado solicita), lista de
atendimentos com filtros, detalhe com inscrições e histórico, inscrever/desistir,
registrar presença com seleção de ausentes, cancelar com motivo, "meus atendimentos".
Tratamento cuidadoso de fuso e de todos os 409 de conflito.
**Critério:** o fluxo do `scripts/fluxo-completo.mjs` roda inteiro pela interface.

### Etapa 7 — Avaliações e materiais
Modal de avaliação (habilitado só com REALIZADO + PRESENTE), resumo com média,
avaliações por monitor. Acervo: publicar, listar, editar, remover (soft delete),
toggle "mostrar removidos". Sem upload (G13).
**Critério:** RN05/RN06/RN07/RN08 observáveis pela interface.

### Etapa 8 — Gamificação, indicadores e acabamento
"Meus pontos" (com a ressalva do G10), ranking geral e por monitoria, dashboards de
professor e de aluno, indicadores da monitoria e desempenho por monitor (gráficos).
Passada final de responsividade, estados vazios, skeletons, acessibilidade e revisão de
mensagens de erro.
**Critério:** os dois dashboards completos e a aplicação utilizável em 375 px.

### Fora do plano (dependem do backend)
Upload de material (G13), gestão de usuários (G14), notificações (G15), busca de alunos
no servidor (G1), renovação de sessão (G2).

---

## Apêndice — armadilhas de integração

Uma lista curta do que erra primeiro em um projeto com este contrato:

1. **`alunoId` ≠ `participanteId`.** `alunoId` é o **id do usuário**; `participanteId` é o
   id do **vínculo**. `monitorParticipanteId`, `participanteId` (disponibilidade) e o
   `id` dentro de `inscricoes[]` são todos ids de vínculo/inscrição, nunca de usuário.
   O próprio vínculo vem pronto em `monitoria.meuParticipanteId` — não varra `/participantes`
   procurando por si mesmo.
2. **`ausentes` em `/realizar` recebe ids de INSCRIÇÃO** (`inscricoes[].id`), não de
   participante nem de usuário.
3. **Datas.** Enviar `inicio`/`fim` em ISO 8601 com fuso; montar o instante a partir do
   **fuso da instituição**, obtido em `GET /api/configuracao` — nunca do navegador nem
   hardcoded (G23). Os limites de duração e antecedência vêm do mesmo endpoint: use-os para
   montar a validação Zod do formulário, em vez de repetir 15/240 no cliente.
4. **`diaSemana` é 0 = domingo**, compatível com `Date.getDay()` e com `EXTRACT(DOW)`.
5. **`horaInicio`/`horaFim`** entram como `"HH:MM"` e voltam como `"HH:MM:SS"`.
6. **`perfis` é uma lista.** Nunca `usuario.perfil`.
7. **`forbidNonWhitelisted` está ligado:** mandar um campo a mais no corpo devolve **400**.
   Enviar exatamente os campos do DTO — nada de espalhar o objeto do formulário inteiro.
8. **Nenhuma rota aceita `DELETE`.** Todo "remover" é um `POST` de ação.
9. **`GET /atendimentos/meus` devolve vazio para quem é só PROFESSOR** — ele não tem vínculo
   de participante. A agenda do professor é `GET /monitorias/:id/atendimentos`.
10. **"Aceita inscrição" agora vem pronto** no campo `aceitaInscricao`, avaliado no relógio
    do servidor. Não recalcule com `Date.now()` do navegador.
11. **`/monitorias/minhas` mudou de formato e de default.** É `{dados, meta}` e traz só
    PLANEJADA+ATIVA; a tela de histórico precisa pedir os status terminais explicitamente.
12. **`expiraEm` está *deprecated*.** Use `expiraEmSegundos` / `expiraEmIso`.
