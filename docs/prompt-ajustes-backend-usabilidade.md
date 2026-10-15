# Ajustes na API — backend `D:\TCC\backend`

Seis adições e uma remoção de linha morta, vindas de uma auditoria de usabilidade do frontend.
Tudo **aditivo**: não remova, renomeie nem altere o significado de nada existente — o frontend
depende de todos os contratos atuais.

Onde este documento contradisser o código, o código vence: relate a divergência.
Nos pontos marcados **DECISÃO NECESSÁRIA**, pergunte antes de escolher.

---

## A1. `GET /monitorias/:monitoriaId/horarios-livres`

Devolve horários concretos e clicáveis, para substituir os três campos digitados (data, início,
término) do formulário de agendamento. O cliente não consegue calcular isso: a validação de janela
roda em SQL com `AT TIME ZONE`, as constraints `EXCLUDE` da RN03 também batem contra as inscrições
do solicitante em monitorias que ele não pode ler, e a antecedência mínima depende do relógio do
servidor.

**Controller:** `atendimentos-monitoria.controller.ts` (junto do `POST`).
**Autorização:** autenticado, mesmo critério aberto já usado em `GET /disponibilidades`.

**Query (`FiltroHorariosLivresDto`):**

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| `de` | ISO 8601 | sim | |
| `ate` | ISO 8601 | sim | máx. 60 dias após `de`, senão 400 |
| `duracaoMinutos` | int | não | padrão `agenda.duracaoPadraoMinutos` (B1); validado contra mín./máx. existentes |
| `monitorParticipanteId` | uuid | não | omitido = todos os monitores ativos |

**Resposta 200** — lista de `{ inicio, fim, monitorParticipanteId, nomeMonitor }`, ordenada por
`inicio` e depois `nomeMonitor`. Teto de 500 slots; trunque e documente.

**Algoritmo:**

1. Disponibilidades **ativas** dos monitores ativos da monitoria.
2. Expanda as faixas semanais nas ocorrências dentro de `[de, ate]` **em SQL**, no fuso da
   instituição, como `validarJanela` já faz — não em JavaScript.
3. Fatie em slots de `duracaoMinutos` alinhados ao início da faixa; descarte o resto.
4. Subtraia: atendimentos `AGENDADO` daquele monitor que se sobreponham; inscrições
   `INSCRITO`/`PRESENTE` **do usuário autenticado** em qualquer monitoria (pule quando ele não tiver
   vínculo de aluno); slots antes de `now() + antecedenciaMinimaMinutos`.

Documente no `@ApiOperation` que é **sugestão calculada no instante da consulta, não reserva** — a
verificação autoritativa continua no `POST`, e dois usuários podem receber o mesmo slot.

Sem migration.

---

## A2. `POST /monitorias/:monitoriaId/atendimentos/lote`

Cria uma série de sessões recorrentes numa requisição. Hoje abrir 15 sessões semanais é trabalho
manual repetido que ninguém conclui.

**Autorização:** idêntica ao `POST` atual —
`@ExigeParticipacao({ papeis: [MONITOR, MONITORADO], professorResponsavel: 'NEGADO' })`.

**Body (`AgendarAtendimentosEmLoteDto`):** campos comuns do `AgendarAtendimentoDto`
(`monitorParticipanteId?`, `assunto`, `modalidade`, `local?`, `vagas?`) mais:

```jsonc
"ocorrencias": [ { "inicio": "...", "fim": "..." } ]   // 1 a 30
```

Valide com `@ArrayMinSize(1)`, `@ArrayMaxSize(30)`, `@ValidateNested({ each: true })`.

**Sucesso parcial, não tudo-ou-nada.** Cada ocorrência na **sua própria transação**: feriado ou
choque pontual não pode derrubar a série, senão o endpoint não resolve o problema que motiva sua
existência.

**Resposta 200** (não 201 — a criação é parcial por natureza), preservando a ordem de entrada:

```jsonc
{
  "criados": 12,
  "recusados": 1,
  "resultados": [
    { "inicio": "...", "fim": "...", "criado": true,  "atendimentoId": "uuid" },
    { "inicio": "...", "fim": "...", "criado": false, "erro": "Conflito de horario (RN03)." }
  ]
}
```

Extraia o corpo do `agendar` existente para um método privado; não duplique.

### DECISÃO NECESSÁRIA — avalanche de e-mail

Cada criação emite `EVENTO_ATENDIMENTO_AGENDADO`, e `aoAgendar` avisa **todos** os monitorados
ativos quando a origem é `OFERTA_MONITOR`. Um lote de 16 sessões com 20 monitorados dispara
**320 e-mails**: queima cota do Brevo, e quem marcar spam derruba a entrega do lembrete do dia.

- **Opção 1 (implemente esta salvo instrução em contrário, sem migration).** O lote emite o evento
  **uma única vez**, referente à primeira ocorrência, com um campo opcional `demaisSessoes?: number`
  no despacho. A mensagem de `ATENDIMENTO_OFERTADO` ganha "e mais N sessões na mesma faixa de
  horário", com link para a agenda da monitoria.
- **Opção 2.** Novo `TipoNotificacao.SERIE_DE_SESSOES_ABERTA` — **exige migration**
  (`enum_notificacoes_tipo` é ENUM no Postgres, então `ALTER TYPE ... ADD VALUE`; confira se roda
  fora de transação na versão em uso).

Em nenhuma hipótese um evento por ocorrência.

---

## A3. `POST /monitorias/:monitoriaId/participantes/:participanteId/promover-a-monitor`

Hoje promover é `encerrar` + `POST /monitores`: não é atômico — se o segundo passo falhar o aluno
fica **sem vínculo nenhum** — e `encerrarVinculo` dá 409 havendo atendimento `AGENDADO`, o que
impede a promoção de um monitorado com sessão marcada.

**Controller:** `participantes.controller.ts`.
**Autorização:** `@ExigeParticipacao({ professorResponsavel: 'EXIGIDO' })` (RN01).

**Em uma única transação:**

1. Participante inexistente na monitoria → 404.
2. Já é `MONITOR` → 409. Vínculo não `ATIVO` → 409.
3. Encerre o vínculo `MONITORADO` preservando histórico (RN10).
4. Crie o vínculo `MONITOR` para o mesmo aluno.
5. Emita `MonitorHabilitadoEvento` com o id do **novo** vínculo.
6. Devolva `ParticipanteRespostaDto` do vínculo novo.

A RN09 é respeitada naturalmente: dentro da transação o antigo sai de `ATIVO` antes de o novo entrar.

### DECISÃO NECESSÁRIA — inscrições já agendadas

O que acontece com os atendimentos em que o aluno está inscrito como monitorado?

- **(a)** Preservar as inscrições — exige verificar se as constraints `EXCLUDE` e as consultas de
  agenda toleram inscrição cujo vínculo está `ENCERRADO`.
- **(b)** Recusar com 409 enquanto houver `AGENDADO`, dizendo quantas sessões resolver primeiro.
- **(c)** Cancelar as inscrições e avisar o aluno.

Investigue o comportamento atual das constraints diante de vínculo encerrado, relate e **pergunte**.
Sem resposta, implemente **(b)** (é o comportamento de hoje) e documente a troca.

Sem migration.

---

## A4. Dois filtros derivados em `FiltroAtendimentosDto`

Siga o padrão do `aceitandoInscricao` que já existe no arquivo (derivado no servidor, `@Transform`
string→boolean, `@IsBoolean`).

**`aguardandoRegistro=true`** → `status = AGENDADO`, `inicio < now()`, e o autenticado é o **monitor**
da sessão. Alimenta a fila "aguardando seu registro de presença", que hoje não existe em lugar
nenhum — e sem `REALIZADO` + `PRESENTE` o aluno não pode avaliar (RN06) e ninguém pontua.

**`pendentesDeAvaliacao=true`** → `status = REALIZADO`, inscrição do autenticado `PRESENTE`, sem
avaliação dele. Reaproveite o critério de `InscricaoRespostaDto.podeAvaliar` para que os dois nunca
divirjam. Hoje o dashboard aproxima paginando os últimos 20, e o contador sai errado.

**Escopo:** só em `GET /atendimentos/meus`. Em `GET /monitorias/:id/atendimentos`, **400** com
mensagem explicando que são filtros de agenda pessoal — não ignore em silêncio. Os dois juntos são
mutuamente exclusivos: **400**, não lista vazia.

Sem migration.

---

## B1. `duracaoPadraoMinutos` em `GET /configuracao`

Só existem mínimo e máximo hoje. O cliente precisa de um padrão para o tamanho de slot de A1 e para
oferecer duração em botões ("30 min / 1 h / 1 h 30") em vez de início **e** término digitados.

- `AGENDAMENTO_DURACAO_PADRAO_MINUTOS` em `configuration.ts`, dentro de `agenda`, default `60`.
- Validação em `env.validation.ts`, junto das demais `agenda.*`.
- **Valide a coerência no boot:** `duracaoMinima <= duracaoPadrao <= duracaoMaxima`.
- Acrescente o campo a `LimitesAgendamentoDto` e ao retorno do controller.

---

## B2. `GET /gamificacao/regras`

A tabela `PONTOS` é constante privada em `gamificacao.service.ts:25`, então a tela de ranking não
pode dizer quanto vale cada coisa. Autenticada, somente leitura:

```jsonc
{
  "regras": [
    { "tipo": "ATENDIMENTO_REALIZADO",    "pontos": 10,   "descricao": "..." },
    { "tipo": "PARTICIPACAO_ATENDIMENTO", "pontos": 5,    "descricao": "..." },
    { "tipo": "AVALIACAO_RECEBIDA",       "pontos": null, "descricao": "Vale a propria nota recebida, de 1 a 5." }
  ]
}
```

`null` em `AVALIACAO_RECEBIDA` é intencional e documentado — o valor é variável, por isso a
constante guarda `0`. Não force um número.

Mantenha no módulo de gamificação, não em `/configuracao`: gamificação é módulo folha, removível do
`AppModule` sem quebrar o núcleo.

---

## C1. Remover `console.log()` órfão

`notificacoes.service.ts:117`, primeira linha de `aoAgendar`. Resíduo de depuração que imprime uma
linha em branco a cada agendamento. Remova a linha, nada mais.

---

## NÃO implemente

Saíram da auditoria por já estarem resolvidos ou serem resolvíveis só no frontend:

lembretes por e-mail (o `NotificacoesService` já cobre tudo) · duplicar atendimento (pré-preenche e
usa o `POST` atual) · exportar `.ics` · exportar CSV · sugerir assuntos recentes (derivável da
listagem) · lote de disponibilidades (≤7 POSTs, falha inofensiva) · busca global (`?busca` já existe
em monitorias e alunos) · criar disciplina inline (`POST /disciplinas` já existe) · indicadores
clicáveis, visão de calendário, desfazer em vez de confirmar, checklist de primeiros passos, barra
de ação fixa no celular.

---

## Critérios de aceite

1. **Swagger** em toda rota nova, com `description` cobrindo a semântica — "sugestão, não reserva"
   em A1, "sucesso parcial" em A2 — e os 400/403/409 cabíveis.
2. **Testes**, no mínimo:
   - A1: slot livre aparece; slot ocupado pelo monitor não; slot que conflita com a agenda do
     solicitante **em outra monitoria** não; janela > 60 dias → 400.
   - A2: uma ocorrência conflitante devolve `criados: n-1` com as demais criadas; **um único** evento
     de notificação emitido.
   - A3: falha forçada no passo 2 deixa o vínculo original intacto.
   - A4: os filtros em `/monitorias/:id/atendimentos` devolvem 400.
3. **Nenhuma migration**, salvo a Opção 2 de A2 — e aí justifique.
4. Atualize `docs/arquitetura.md` com as rotas novas, no estilo do documento.
5. **Relatório final** por item (implementado / recusado / adiado, com motivo) e, nas duas
   DECISÃO NECESSÁRIA, qual caminho tomou e por quê.
