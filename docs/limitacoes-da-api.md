# Limitações da API encontradas na implementação

> Registradas em 2026-09-09, durante a implementação das funcionalidades do frontend.
> **Nada foi contornado com solução fictícia**: onde a API não oferece algo, a interface
> declara a ausência ou deriva o dado de forma explícita a partir do que existe.
>
> **Revisão de 2026-10-15.** Uma auditoria de usabilidade identificou pontos de atrito que
> não podiam ser resolvidos no cliente. Eles viraram um pedido ao backend
> (`prompt-ajustes-backend-usabilidade.md`), e os ajustes A1–A4/B1–B2 foram implementados.
> A limitação **nº 2 deixou de existir**; a nº 4 continua, com o escopo reduzido. As demais
> seguem válidas. As que foram resolvidas estão marcadas, não apagadas: o registro de que
> existiram é parte do raciocínio do projeto.

---

## 1. Upload de arquivo em materiais não existe

**O que a API oferece:** `POST /monitorias/:id/materiais` aceita apenas
`{ titulo, descricao?, url }` e grava sempre `tipo = LINK`. As colunas `arquivo_chave`,
`arquivo_mime`, `arquivo_tamanho_bytes` e `arquivo_checksum_sha256` existem no schema, e o
enum tem o valor `ARQUIVO`, mas **nenhum endpoint os produz** e não há `StorageService`.

**O que o frontend faz:** a tela de materiais oferece somente publicação de link, e o
diálogo diz textualmente "o material é um link. A plataforma não hospeda arquivos".

**O que NÃO foi feito:** nenhum seletor de arquivo, nenhuma simulação de upload, nenhum
botão de download. Oferecer e falhar seria pior que a ausência declarada.

---

## 2. ~~Não existe endpoint de "avaliações pendentes"~~ — RESOLVIDA em 2026-10-15

**Como era:** não havia recorte no servidor. O dashboard pedia os 20 atendimentos
`REALIZADO` mais recentes e filtrava os que tinham a própria inscrição com `podeAvaliar`.
Quem tivesse histórico maior que 20 **não via parte das pendências**, e o contador saía
errado — sem nenhum sinal de que estava incompleto.

**Como ficou:** `GET /atendimentos/meus?pendentesDeAvaliacao=true` (ajuste A4). O recorte é
feito no servidor, com o mesmo critério que decide `podeAvaliar`, então lista e botão não
podem discordar. O mesmo ajuste trouxe `aguardandoRegistro=true`, que resolve a pendência
simétrica do monitor — sessão que já aconteceu e continua `AGENDADA` — e que **não existia
em tela nenhuma**, apesar de travar a cadeia inteira: sem `REALIZADO` + `PRESENTE`, o aluno
não pode avaliar (RN06) e ninguém pontua.

As duas alimentam a fila "O que precisa de você" no dashboard.

---

## 3. Sem ordenação configurável fora de atendimentos

**O que a API oferece:** `?ordenarPor` e `?direcao` apenas em
`GET /monitorias/:id/atendimentos` e `GET /atendimentos/meus`. As demais listagens têm
ordem fixa no service.

**O que o frontend faz:** usa a ordenação do servidor onde ela existe (agenda ascendente,
histórico descendente) e **não** reordena no cliente onde ela não existe.

**Por quê:** ordenar client-side apenas a página atual produziria uma ordem falsa — o item
"maior" pode estar na página seguinte. Uma ordenação errada é pior que a ausência dela.

---

## 4. Contagem de atendimentos com presença é aproximada no dashboard

**O que a API oferece:** `GET /analytics/monitorias/:id` traz `alunosAtendidos` por
monitoria, e `GET /analytics/resumo` traz o total da plataforma — mas **não há um indicador
"meus atendimentos com presença"** para o aluno.

**O que o frontend faz:** conta, entre os 20 atendimentos realizados mais recentes, aqueles
em que a própria inscrição está `PRESENTE`. O cartão diz "nos 20 mais recentes".

**Alternativa descartada:** somar os eventos de `PARTICIPACAO_ATENDIMENTO` em
`/gamificacao/meus-pontos` daria o número certo, mas acopla um indicador acadêmico à
gamificação — que pode ter suas regras alteradas sem que isso signifique mudança no
histórico de atendimentos.

**Escopo reduzido em 2026-10-15:** a aproximação continua, mas agora vale só para este
indicador. O que dependia dela e tinha consequência — a lista de avaliações pendentes —
passou a vir do servidor (ver nº 2). Um indicador com recorte declarado é aceitável; uma
fila de pendências incompleta não era.

---

## 5. Professor não tem agenda pessoal

**O que a API faz:** `GET /atendimentos/meus` monta a consulta a partir dos vínculos do
aluno. Um usuário apenas PROFESSOR recebe lista vazia.

**Avaliação:** **não é um defeito** — é coerente com o domínio. O professor administra a
monitoria mas não atende nem é atendido; não existe vínculo dele que ocupe agenda.

**O que o frontend faz:** em vez de mostrar uma lista vazia que pareceria erro, a tela
explica a razão e aponta para os atendimentos dentro de cada monitoria.

---

## 6. Disponibilidade não tem edição — só criação e desativação

**O que a API oferece:** `POST` para criar e `POST /:id/desativar`. Não há `PATCH`.

**Por quê (leitura do domínio):** atendimentos já agendados foram validados contra a faixa;
alterá-la retroativamente destruiria a justificativa daqueles agendamentos (RN10).

**O que o frontend faz:** o fluxo de "editar" é desativar a faixa antiga e criar a nova —
apresentado como tal, sem um botão "editar" que esconderia duas operações.

---

## 7. Sobreposição de disponibilidade não é verificável antes do envio

**O que a API garante:** a constraint `ex_disponibilidade_sem_sobreposicao` recusa faixas
sobrepostas com 409.

**O que o frontend faz:** valida no cliente apenas o que é local e determinístico
(`horaFim > horaInicio`, formato). A sobreposição é deixada para o backend.

**Por quê:** verificar sobreposição no cliente exigiria manter uma cópia do estado do
servidor, que fica desatualizada entre a leitura e o envio — criando uma segunda fonte de
verdade que discordaria da primeira sob concorrência.

---

## 8. Contas só nascem pelas mãos de um professor — e a troca de senha não é obrigatória

**O que a API faz:** as rotas públicas `POST /auth/registro/aluno` e
`/auth/registro/professor` foram removidas. Contas são criadas apenas por
`POST /alunos` e `POST /professores`, ambos `@Perfis(PROFESSOR)`, com uma
`senhaProvisoria` definida por quem cria. `criadoPorUsuarioId` registra a autoria.

**O que o frontend faz:** a tela de login não oferece mais "criar conta" — diz que as
contas são criadas por professores. O cadastro mora em **Pessoas** (menu de Gestão), com
gerador de senha legível e uma tela final com os dados de acesso e o aviso "Oriente a
pessoa a trocar a senha no primeiro acesso, em Minha conta".

**Limitação residual:** o backend não tem `deveTrocarSenha`; nada obriga a troca. A tela
**orienta**, e não finge que força.

## 11. Cursos: sem a visão "disciplinas deste curso" a partir do catálogo

> Registrada em 2026-10-16, ao construir o CRUD de cursos.

**O que a API oferece:** `GET /cursos` com `busca`, `ativo` e paginação (teto de 100 por
página, como todo `PaginacaoDto`). A relação N:N é mantida **pelo lado da disciplina**
(`cursosIds` em `POST`/`PATCH /disciplinas`), e `DisciplinaRespostaDto` devolve `cursos[]`.

**Duas consequências:**

1. **Não há `GET /disciplinas?cursoId=…`.** Não existe, portanto, a visão "disciplinas deste
   curso" a partir da tela de Cursos. Montá-la no cliente exigiria paginar o catálogo inteiro
   e cruzar em memória — que fica errado assim que passa de uma página. A tela de Cursos não
   oferece essa visão, em vez de oferecer uma versão que mente.

2. ~~**O seletor de cursos mostra no máximo 100 ativos.**~~ **RESOLVIDA em 2026-10-19.** Os
   seletores de curso e de disciplina viraram `<ComboBox>`: buscam no servidor (`busca`) e
   carregam por página sob demanda. Não há mais teto — e o filtro restaurado da URL resolve o
   rótulo do selecionado por `GET /cursos/:id`, para o gatilho não ficar vazio quando o id
   escolhido está numa página que nunca foi carregada.

**O que o frontend faz:** o seletor pede `ativo=true` e acrescenta os cursos **já vinculados**,
mesmo inativos. Isso não é cosmético: `cursosIds` SUBSTITUI o conjunto, então um curso
desativado que sumisse da lista seria silenciosamente desvinculado ao salvar.

---

## 9. ~~Listas de professores sem busca~~ — RESOLVIDA em 2026-10-19

**Como era:** `GET /professores` e `GET /professores/publicos` aceitavam apenas paginação. A
aba Professores de Pessoas não tinha campo de busca, e o seletor de professor do formulário
público filtrava só o que já estava carregado — avisando disso, para que ninguém concluísse
que um docente não existe quando ele apenas estava na página seguinte.

**Como ficou:** os dois endpoints aceitam `busca`, e **com escopos diferentes de propósito**:

| Rota | A busca varre |
|---|---|
| `GET /professores` (autenticada) | nome, e-mail, identificação funcional e departamento |
| `GET /professores/publicos` | **nome e departamento apenas** |

A assimetria é de segurança, não de comodidade. `ProfessorPublicoDto` já omite o e-mail para
não entregar endereços a um anônimo; se a busca pública aceitasse e-mail, qualquer pessoa
poderia digitar `fulano@ufx.edu.br` e descobrir, pelo acerto ou pelo vazio, se aquele endereço
pertence a um docente — o endereço não apareceria na resposta, mas a resposta o **confirmaria**.

**O que o frontend faz:** a aba Professores ganhou busca ("nome, e-mail, SIAPE ou
departamento"), e o seletor do formulário público busca no servidor com o placeholder
"Buscar por nome ou departamento…" — ele não promete um campo que a rota não varre.

**Consequência no código:** com todos os catálogos (`/cursos`, `/disciplinas`, `/alunos`,
`/professores`, `/professores/publicos`) aceitando `busca`, o modo de busca local do
`useListaParaCombo` ficou sem nenhum usuário e foi removido, junto com o aviso de busca
parcial do `<ComboBox>`. Um ramo que nada exercita sugeriria que alguma lista ainda filtra
em memória.

---


## 10. Redefinir a senha não encerra sessões já abertas

**O que a API faz:** `POST /auth/recuperacao/solicitar` e `/confirmar` trocam a senha a
partir de um código de 6 dígitos (15 minutos, uso único, 5 tentativas). O JWT é stateless
e não há revogação: um token emitido antes da troca continua válido até expirar (8 h).

**O que o frontend faz:** a tela de conclusão diz apenas que a senha foi trocada e leva ao
login. **Não** afirma que outros dispositivos foram desconectados, porque não foram.

**Outras escolhas honestas da tela:**
- fala sempre no condicional ("se houver uma conta com este e-mail..."), porque o backend
  responde 202 para qualquer endereço e a tela não pode virar um enumerador de contas;
- o e-mail fica em memória entre as etapas, nunca na URL; recarregar volta ao início;
- não existe rota "só validar o código" (seria um oráculo), então código e nova senha são
  pedidos juntos;
- o limite de 3 pedidos por minuto aparece como mensagem de 429 traduzida.

**Em desenvolvimento:** sem `BREVO_API_KEY`, o backend não envia e-mail e registra o código
no próprio log (`[DESENVOLVIMENTO] Codigo de recuperacao de ...`).

---

## Armadilha confirmada em teste: o fuso horário

Não é limitação da API, mas o registro vale.

Durante a verificação ponta a ponta, um reagendamento foi recusado com 409. A investigação
mostrou que **o erro estava no script de teste**, não na aplicação: a máquina está em
UTC−4 (Brasil Central) e a instituição opera em `America/Sao_Paulo` (UTC−3). O script
montou o instante com o fuso do sistema, e o horário caiu fora da faixa de disponibilidade.

É exatamente a falha que o frontend evita ao montar todo instante com
`instanteDeDataHoraLocal(data, hora, fuso)`, usando o fuso vindo de `GET /api/configuracao`.
O backend estava certo em recusar.
