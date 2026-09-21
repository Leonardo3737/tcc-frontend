# Prompt — Ajustes necessários no backend

> Copie o bloco abaixo inteiro e envie em uma nova conversa, com a pasta `backend/` aberta.
> Ele é autocontido: não depende do histórico desta conversa.

---

Estamos desenvolvendo o TCC "Proposta de uma Plataforma Digital para Apoio à Monitoria no
Ensino Superior". O backend (NestJS 11 + Sequelize 6 + PostgreSQL) já está implementado
nesta pasta e o frontend (Next.js + TypeScript) começará a ser desenvolvido em seguida.

Fiz uma análise completa do backend contra o consumo previsto pelo frontend e levantei uma
lista de ajustes. Preciso que você **analise cada item, confirme ou refute o diagnóstico
lendo o código, e então implemente os que forem aprovados**.

## Regras de trabalho

1. **Leia o código antes de concordar comigo.** Se algum item abaixo estiver incorreto,
   diga explicitamente e não implemente. Prefiro um item recusado com justificativa a um
   ajuste feito sobre um diagnóstico errado.
2. **Não quebre contratos existentes sem necessidade.** Onde for possível resolver com
   campo novo (aditivo), prefira isso a renomear ou remover campo existente.
3. **Mantenha o estilo do projeto:** DTOs com `class-validator` + `@ApiProperty`, mapeamento
   explícito `deModelo`, regra de negócio no service, autorização por guard quando a rota
   tem `:monitoriaId`, comentários explicando o *porquê* das decisões (como já é o padrão).
4. **Toda alteração de schema vai por migration versionada.** `synchronize` continua
   proibido (AD-04). Se um item não exigir migration, diga isso explicitamente.
5. **Não destrua histórico (RN10).** Nenhum `DELETE` novo na API.
6. **Atualize o Swagger e o README** a cada mudança de contrato.
7. Se um item exigir uma decisão de produto que você não pode tomar sozinho
   (por exemplo, refresh token ou visibilidade de disponibilidades), **pare e me pergunte**
   antes de implementar.
8. Rode `npm run lint`, `npm run test` e, quando o banco estiver disponível,
   `npm run test:fluxo` ao final.

## Ordem de execução

Trabalhe em três blocos, nesta ordem, e me mostre o resultado ao fim de cada bloco:
**Bloco A (bugs e correções de contrato) → Bloco B (bloqueadores do frontend) →
Bloco C (decisões e documentação)**.

---

# BLOCO A — Bugs e correções de contrato

## A1. `GET /api/gamificacao/meus-pontos` soma apenas os 100 eventos mais recentes

**Onde:** `src/modules/gamificacao/gamificacao.service.ts`, método `meusPontos`.

**Diagnóstico:** o método faz `findAll({ where, order: [['criado_em','DESC']], limit: 100 })`
e depois calcula `total` e `porTipo` **em memória, sobre essas 100 linhas**. Já o método
`ranking` soma tudo via SQL (`SUM(p.pontos)`).

**Efeito:** um usuário com mais de 100 eventos de pontuação vê, no próprio extrato, um
total **menor** do que o total exibido para ele no ranking. É uma inconsistência numérica
visível ao usuário final.

**Ajuste pedido:** calcular `total` e `porTipo` por agregação no banco (`SUM` + `GROUP BY tipo`),
respeitando o filtro opcional `monitoriaId`. O `limit` continua valendo **apenas** para
`ultimosEventos`. Confirme que `/meus-pontos` e `/ranking` passam a bater para o mesmo usuário.

## A2. `FiltroRankingDto.limite` é aceito e silenciosamente ignorado em `/meus-pontos`

**Onde:** `src/modules/gamificacao/gamificacao.controller.ts` — o endpoint `meusPontos`
recebe `@Query() filtro: FiltroRankingDto`, mas passa apenas `filtro.monitoriaId` ao service.

**Efeito:** parâmetro documentado no Swagger que não faz nada. Como `forbidNonWhitelisted`
está ligado, o cliente é levado a crer que o campo é suportado.

**Ajuste pedido:** ou honrar o `limite` em `ultimosEventos` (preferível), ou criar um
`FiltroMeusPontosDto` só com `monitoriaId`. Escolha uma e justifique.

## A3. `RespostaPaginada<T>` não é descrita no Swagger

**Onde:** `src/common/dto/resposta-paginada.dto.ts` — o campo `dados: T[]` **não tem
`@ApiProperty`**, e os controllers usam `@ApiOkResponse({ type: RespostaPaginada })` sem o
genérico.

**Efeito:** o documento OpenAPI descreve todas as listagens paginadas como um objeto sem o
array `dados`. Qualquer geração de tipos a partir do Swagger (`openapi-typescript`) produz
tipos errados, e a documentação não serve como contrato para o frontend.

**Ajuste pedido:** usar o padrão de genéricos do `@nestjs/swagger` — `@ApiExtraModels`,
`getSchemaPath` e um decorator utilitário do tipo `@ApiRespostaPaginada(Dto)` aplicado em
todas as rotas paginadas (alunos, professores, disciplinas, monitorias, participantes,
atendimentos, materiais). Depois, confirme que `/docs-json` descreve `dados` corretamente.

## A4. `expiraEm` no login não é utilizável programaticamente

**Onde:** `src/modules/auth/auth.service.ts` → `RespostaLoginDto.expiraEm` devolve a string
de configuração (`"1h"`), copiada de `JWT_EXPIRES_IN`.

**Efeito:** o frontend não consegue saber quando a sessão expira sem decodificar o JWT por
conta própria. Para definir o `maxAge` do cookie de sessão, precisa fazer parsing de `"1h"`
ou do payload — ambos frágeis.

**Ajuste pedido:** manter `expiraEm` (compatibilidade) e **acrescentar** `expiraEmSegundos:
number` e/ou `expiraEmIso: string`, derivados do claim `exp` do token efetivamente assinado
— não de uma reinterpretação da string de configuração.

## A5. Formato de resposta assimétrico entre listagens

**Diagnóstico:** algumas listagens devolvem `RespostaPaginada` (`{dados, meta}`) e outras
devolvem array cru:

- **Paginadas:** `/alunos`, `/professores`, `/disciplinas`, `/monitorias`,
  `/monitorias/:id/participantes`, `/monitorias/:id/atendimentos`, `/atendimentos/meus`,
  `/monitorias/:id/materiais`
- **Array cru:** `/monitorias/minhas`, `/monitorias/:id/disponibilidades`,
  `/atendimentos/:id/historico`, `/gamificacao/ranking`,
  `/analytics/monitorias/:id/monitores`

**Efeito:** o cliente precisa de dois caminhos de desserialização e não consegue tratar
listagens de forma genérica.

**Ajuste pedido:** avalie e proponha. Minha sugestão é **paginar `/monitorias/minhas`**
(ver A6) e deixar as demais como array, **desde que isso seja documentado como decisão
consciente** — coleções pequenas e limitadas por natureza (faixas de horário, histórico de
um atendimento, top N do ranking) não precisam de envelope. Se você discordar, diga.

## A6. `/api/monitorias/minhas` não é paginado nem filtrável

**Onde:** `src/modules/monitorias/monitorias.service.ts`, método `minhas`.

**Diagnóstico:** faz `findAll` sem `limit`, sem `offset` e sem filtro de status. É a
consulta que alimenta o dashboard de ambos os perfis.

**Efeito:** cresce indefinidamente a cada semestre. Um professor com 20 semestres de
histórico recebe tudo em uma resposta, e o frontend não tem como pedir "só as ativas".

**Ajuste pedido:** aceitar `?status=`, `?ano=`, `?semestre=` e paginação. Avalie se o
default deve ser "somente não-terminais" (`PLANEJADA`/`ATIVA`) para o dashboard — se sim,
explicite o default no Swagger.

## A7. Nenhum endpoint aceita ordenação configurável

**Diagnóstico:** a ordem é fixa no service em todas as listagens.

**Efeito:** o frontend só consegue reordenar dentro da página atual, o que produz ordenação
incorreta quando há mais de uma página.

**Ajuste pedido:** avalie o custo/benefício. Se implementar, faça com **whitelist de campos
por endpoint** (`?ordenarPor=nome|criadoEm&direcao=asc|desc`), nunca aceitando nome de
coluna livre do cliente — SQL injection por `ORDER BY` é o risco óbvio. Se decidir não
implementar, registre a limitação no README.

---

# BLOCO B — Bloqueadores do frontend

## B1. `GET /api/alunos` não permite buscar aluno

**Onde:** `src/modules/usuarios/alunos.controller.ts` + `usuarios.service.ts` (`listarAlunos`).

**Diagnóstico:** recebe apenas `PaginacaoDto` (máx. 100 por página), ordenado por nome.

**Efeito:** este endpoint existe justamente para o fluxo da **RN01** — o professor precisa
localizar um aluno para habilitá-lo como monitor. Sem busca, em uma base institucional real
o professor teria que paginar às cegas. O comentário no próprio controller diz que a rota
existe para esse fim.

**Ajuste pedido:** criar `FiltroAlunosDto extends PaginacaoDto` com `?busca=` fazendo
`ILIKE` em **nome, matrícula e e-mail**. Avalie também um filtro
`?semVinculoAtivoNaMonitoria=<uuid>` para o professor ver apenas quem ainda pode ser
habilitado (evita 409 de RN09 previsível). Se achar que o segundo filtro acopla demais
`UsuariosModule` a `MonitoriasModule`, proponha alternativa.

## B2. `GET /api/monitorias` não permite busca textual

**Diagnóstico:** `FiltroMonitoriasDto` aceita `disciplinaId`, `professorId`, `ano`,
`semestre`, `status` — nenhum campo de texto.

**Efeito:** a tela "explorar monitorias" do aluno precisa de dois passos: buscar em
`/disciplinas?busca=Cálculo`, pegar o `id`, e só então filtrar monitorias. Buscar pelo nome
do professor é impossível.

**Ajuste pedido:** adicionar `?busca=` cobrindo **código e nome da disciplina** e,
se for barato, o nome do professor (join já existente em `INCLUDE_PADRAO`).

## B3. Não há como saber se o usuário já avaliou um atendimento

**Onde:** `src/modules/avaliacoes/` e `src/modules/atendimentos/dto/atendimento-resposta.dto.ts`.

**Diagnóstico:** `AvaliacaoRespostaDto` omite a autoria — **e isso está correto** (D-10,
o monitor não deve saber quem deu qual nota). Mas `InscricaoRespostaDto` também não traz
nenhuma marca, e não existe rota `/avaliacoes/minhas`.

**Efeito:** o frontend não tem como decidir se mostra o botão "Avaliar" ou o texto "já
avaliado". A única forma de descobrir é tentar e receber 409 — ou seja, o usuário clica,
espera e leva um erro.

**Ajuste pedido:** expor a informação **sem quebrar o anonimato**. Sugestão: em
`GET /atendimentos/:id`, marcar a inscrição **do próprio requisitante** com
`jaAvaliei: boolean` e `podeAvaliar: boolean` (este último derivado de
`status === REALIZADO && inscricao.status === PRESENTE && !jaAvaliei`). Só a própria
inscrição recebe esses campos; as dos colegas, não. Avalie se é melhor um endpoint
`GET /atendimentos/:id/avaliacao/minha`.

## B4. Disponibilidades só são visíveis para quem já participa da monitoria

**Onde:** `src/modules/disponibilidades/disponibilidades.controller.ts` — `GET` usa
`@ExigeParticipacao()`.

**Diagnóstico:** para ver os horários de atendimento de uma monitoria, o aluno já precisa
ser participante ativo dela.

**Efeito:** inverte o fluxo natural de descoberta. O aluno não consegue avaliar se a
monitoria atende em horário compatível **antes** de se inscrever; precisa entrar primeiro e
descobrir depois.

**Ajuste pedido:** **esta é uma decisão de produto — me pergunte antes de implementar.**
As opções que enxergo: (a) manter como está e o frontend explica; (b) liberar a leitura
para qualquer autenticado, já que horário de atendimento não é dado sensível; (c) criar uma
visão pública reduzida (dia e faixa, sem o nome do monitor). Avalie o impacto em RN07 —
note que RN07 fala de **materiais**, não de disponibilidades, então (b) pode não violar
nada. Traga a sua recomendação.

## B5. Não existe reagendamento de atendimento

**Diagnóstico:** existem `/realizar` e `/cancelar`, mas nenhuma rota altera `inicio`/`fim`
de um atendimento AGENDADO. Ao mesmo tempo, `docs/arquitetura.md` §7.2 documenta a FK
composta com `ON UPDATE CASCADE` **projetada exatamente para propagar o reagendamento** às
inscrições, e a D-22 discute como tratar o erro resultante.

**Efeito:** infraestrutura construída e não usada. Na prática o monitor precisa cancelar
(com motivo obrigatório, que fica no histórico como se algo tivesse dado errado) e criar
outro atendimento — e os inscritos perdem a inscrição.

**Ajuste pedido:** avaliar `POST /api/atendimentos/:id/reagendar` com `{ inicio, fim, motivo }`,
autorizado para o monitor da sessão ou o professor responsável. Precisa: revalidar duração
(15–240 min) e janela de disponibilidade, deixar o `CASCADE` propagar às inscrições, e
traduzir a falha de `ex_aluno_sem_conflito` para **409 informando quais inscritos
conflitam** (é literalmente o que a D-22 recomenda). Registrar a transição no histórico.
Se você achar que isso é escopo demais para o TCC, diga — a alternativa é documentar a
ausência como decisão consciente.

## B6. `AtendimentoRespostaDto` não identifica a monitoria/disciplina

**Onde:** `src/modules/atendimentos/dto/atendimento-resposta.dto.ts` — traz `monitoriaId`,
mas nenhum dado legível da monitoria ou da disciplina. O método `meusAtendimentos` inclui
`INCLUDE_MONITOR` e `INCLUDE_INSCRICOES`, mas não `Monitoria`.

**Efeito:** `GET /atendimentos/meus` é uma agenda **cross-monitoria** — é a tela "Meus
atendimentos". Para escrever "Cálculo I — terça, 14h" o frontend precisa buscar cada
monitoria por id, um request por linha da lista (N+1).

**Ajuste pedido:** incluir um resumo (`monitoria: { id, periodo, disciplina: { codigo, nome } }`)
no DTO, pelo menos em `/atendimentos/meus`. Avalie se vale em todas as rotas de atendimento
ou só nessa — em `/monitorias/:id/atendimentos` a monitoria já é conhecida pela URL.

## B7. O usuário não descobre o próprio `participanteId`

**Onde:** `src/modules/monitorias/dto/monitoria-resposta.dto.ts` — expõe `meuPapel` e
`souResponsavel`, mas não o id do próprio vínculo.

**Diagnóstico:** vários endpoints exigem `participanteId` (id do vínculo, não do usuário):
`GET /monitorias/:mid/monitores/:participanteId/avaliacoes`,
`?participanteId=` em disponibilidades, `?monitorParticipanteId=` em atendimentos.

**Efeito:** para um monitor ver as **próprias** avaliações, o frontend precisa listar
`/participantes` e procurar a si mesmo comparando `alunoId` com o id do usuário. É trabalho
que o backend já fez — `ParticipacaoService.obterContexto` tem o objeto em mãos.

**Ajuste pedido:** acrescentar `meuParticipanteId: string | null` ao `MonitoriaRespostaDto`
quando o contexto for resolvido (`GET /monitorias/:id` e `GET /monitorias/minhas`).
Ajuste aditivo, sem migration.

## B8. "Aceita inscrição" é derivado e não está exposto

**Diagnóstico:** conforme `docs/arquitetura.md` §6.1, não existe estado `ABERTO`: a condição
é `status = AGENDADO AND inscritos_ativos < vagas AND inicio > now()`. O DTO já expõe
`vagasOcupadas`, então o frontend **consegue** derivar.

**Efeito:** cada cliente reimplementa a regra, e o `inicio > now()` depende do relógio do
navegador — que pode estar errado.

**Ajuste pedido:** avaliar expor `aceitaInscricao: boolean` calculado no servidor no
`AtendimentoRespostaDto`, e/ou um filtro `?aceitandoInscricao=true` em
`GET /monitorias/:id/atendimentos`. É conveniência, não bloqueio — decida se paga o custo.

## B9. `GET /atendimentos/meus` retorna vazio para quem é apenas PROFESSOR

**Onde:** `atendimentos.service.ts`, `meusAtendimentos` — monta a consulta a partir de
`listarVinculosDoAluno(usuario.id)`; sem vínculos, retorna lista vazia imediatamente.

**Diagnóstico:** é **coerente com o domínio** — o professor não atende nem é atendido, não
tem vínculo que ocupe agenda. Não considero bug.

**Ajuste pedido:** apenas **documentar isso no Swagger** (`@ApiOperation.description`) e no
README, para que não seja lido como falha de integração. Se você achar que o professor
deveria ver aqui os atendimentos das monitorias que ele responde, traga a proposta — mas
minha inclinação é manter o comportamento e só documentar.

---

# BLOCO C — Decisões pendentes e documentação

## C1. Decidir D-09: renovação de sessão

**Diagnóstico:** JWT stateless com TTL de 1h, sem refresh token, sem `/auth/logout`, sem
revogação. `JwtStrategy` recarrega o usuário do banco a cada requisição (bom: desativação
tem efeito imediato).

**Efeito:** o usuário é deslogado no meio do trabalho, possivelmente com formulário
preenchido. Em uma apresentação de TCC, isso acontece na hora errada.

**Ajuste pedido:** **me pergunte antes de implementar.** Opções: (a) aumentar
`JWT_EXPIRES_IN` (mais simples, menos seguro); (b) refresh token rotativo com tabela de
sessões (mais correto, adiciona schema e um módulo); (c) manter e o frontend trata o 401
com reautenticação preservando o rascunho. Traga prós e contras considerando que é um TCC
com prazo, e uma recomendação.

## C2. Decidir D-15: limites de agendamento como configuração

**Onde:** `atendimentos.service.ts` — `DURACAO_MINIMA_MINUTOS = 15` e
`DURACAO_MAXIMA_MINUTOS = 240` são constantes no arquivo, com um comentário dizendo que
D-15 segue em aberto.

**Ajuste pedido:** mover para `ConfigModule` (env com default e validação Joi), junto com
os itens ainda não implementados da D-15: **antecedência mínima para agendar** e **janela
de cancelamento** (até quantas horas antes o aluno pode desistir — hoje pode desistir até o
instante do início). Se decidir não implementar antecedência/janela, registre como decisão.

## C3. Fechar o cadastro de professor

**Onde:** `auth.service.ts` — com `CODIGO_CADASTRO_PROFESSOR` vazio, o cadastro de professor
fica **aberto**, e o servidor só emite um `logger.warn` no boot.

**Efeito:** qualquer pessoa se cadastra como professor e passa a poder criar monitorias e
habilitar monitores (RN01). Em qualquer ambiente exposto — inclusive uma demonstração
pública — isso invalida a RN01.

**Ajuste pedido:** avaliar **falhar no boot** quando `NODE_ENV === 'production'` e o código
estiver vazio, em vez de apenas avisar. Manter o comportamento permissivo em `development`.

## C4. Corrigir divergências entre `docs/arquitetura.md` e o código

O documento é a referência do TCC e está desatualizado em pontos que confundem quem lê o
projeto pela primeira vez. Encontrei:

1. **Cabeçalho** diz "Avaliações e materiais permanecem no papel" — **ambos estão
   implementados**, com controller, service, DTOs e testes. O README está correto; o
   documento de arquitetura, não.
2. **§10 (estrutura de pastas)** descreve `infra/storage/`, `storage.module.ts`,
   `local-disk.storage.ts`, `inscricoes.controller.ts` e `inscricoes.service.ts` —
   **nenhum existe**. As inscrições foram absorvidas por `AtendimentosService` e viraram
   `POST /atendimentos/:id/inscricao` e `/inscricao/cancelar`.
3. **§8.1** lista `StorageModule` e `CommonModule` entre os módulos — não existem como
   módulos Nest. Faltam na tabela `GamificacaoModule` e `AnalyticsModule`, que existem.
4. **§7.1 (RN06)** fala em `atendimento.status === CONCLUIDO`; o enum real é `REALIZADO`.
5. **§13.1 (D-08)** afirma "oferta nasce CONFIRMADO, solicitação nasce SOLICITADO" — no
   código **ambas nascem AGENDADO**. A revisão 3 já registra a mudança no topo do
   documento, mas a tabela da D-08 não foi atualizada e contradiz o resto.
6. **§10** prevê `test/e2e/`; o que existe é `test/unit/` (5 suítes) e
   `scripts/fluxo-completo.mjs`.

**Ajuste pedido:** atualizar o documento, marcando claramente o que é **projetado** e o que
é **implementado**. Não apague as decisões que não foram implementadas — elas fazem parte
do registro arquitetural do TCC; apenas identifique-as como tal.

## C5. Confirmar o escopo do upload de materiais

**Diagnóstico:** `TipoMaterial.ARQUIVO`, as colunas `arquivo_chave`, `arquivo_mime`,
`arquivo_tamanho_bytes`, `arquivo_checksum_sha256` e o `CHECK ck_material_payload` existem
no schema. Nenhum endpoint produz `ARQUIVO`; não há `StorageService`. `MateriaisService.publicar`
força `tipo: TipoMaterial.LINK`.

**Ajuste pedido:** **decisão sua/minha, não implemente sem confirmar.** Ou (a) implementar o
subsistema completo conforme `docs/arquitetura.md` §7.4 (storage em disco, validação de MIME
por magic number, limite de tamanho, download autenticado por
`GET /materiais/:id/arquivo`, `Content-Disposition: attachment`, `nosniff`), ou (b) manter
fora do escopo e registrar no README que o frontend não deve oferecer upload. Se for (a),
trate como uma fase própria — é o maior item desta lista.

## C6. Documentar o contrato de fuso horário

**Diagnóstico:** `disponibilidades.service.ts` valida a janela em SQL com
`AT TIME ZONE :fuso`, usando `TIMEZONE_INSTITUICAO` (default `America/Sao_Paulo`). O
atendimento é `TIMESTAMPTZ`; a disponibilidade é hora local.

**Efeito:** se o frontend montar o `inicio` a partir do fuso do navegador, o agendamento é
rejeitado com "horário fora da disponibilidade" sem que o usuário entenda por quê. É a
armadilha de integração mais provável do projeto.

**Ajuste pedido:** (a) documentar explicitamente no Swagger de
`POST /monitorias/:id/atendimentos` que `inicio`/`fim` são ISO 8601 com fuso e que a
validação ocorre no fuso da instituição; (b) avaliar expor o fuso configurado em algum
endpoint de metadados (por exemplo, incluí-lo na resposta de `/usuarios/eu` ou criar
`GET /api/config`), para que o frontend não precise ter esse valor hardcoded em dois lugares.

## C7. Confirmar a configuração de CORS para o frontend

**Diagnóstico:** `main.ts` fecha o CORS quando `CORS_ORIGINS` está vazio (comportamento
correto). O `.env.example` aponta `http://localhost:3001`.

**Ajuste pedido:** apenas confirme que `http://localhost:3001` é a porta pretendida para o
frontend em desenvolvimento e mantenha o `.env.example` coerente. Se o frontend for usar o
padrão BFF (chamadas servidor-a-servidor a partir do Next.js), o CORS deixa de importar
para o navegador — mas continua necessário para o Swagger e para depuração direta.

---

## Ao final

Me entregue:

1. **Quais itens você recusou e por quê** (esperado que haja alguns).
2. **Lista das mudanças de contrato da API**, para que eu ajuste os tipos do frontend.
3. **Migrations criadas**, se houver.
4. Resultado de `npm run lint`, `npm run test` e, se possível, `npm run test:fluxo`.
