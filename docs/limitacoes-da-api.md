# Limitações da API encontradas na implementação

> Registradas em 2026-09-09, durante a implementação das funcionalidades do frontend.
> **Nada foi contornado com solução fictícia**: onde a API não oferece algo, a interface
> declara a ausência ou deriva o dado de forma explícita a partir do que existe.
>
> O backend não foi alterado.

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

## 2. Não existe endpoint de "avaliações pendentes"

**O que a API oferece:** `inscricoes[].podeAvaliar`, calculado no servidor
(`REALIZADO` + `PRESENTE` + ainda não avaliado), presente em todas as rotas de atendimento.

**O que o frontend faz:** o dashboard do aluno deriva a lista pedindo os atendimentos
`REALIZADO` mais recentes (`GET /atendimentos/meus?status=REALIZADO&limite=20`) e filtrando
os que têm a própria inscrição com `podeAvaliar`.

**Limitação residual:** a contagem cobre os **20 atendimentos mais recentes**, não o
histórico inteiro. Ampliar isso exigiria um endpoint dedicado ou paginação completa no
cliente — que gastaria requisições sem ganho proporcional. A tela informa o recorte.

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

## 9. Lista de professores sem busca

**O que a API oferece:** `GET /professores` aceita apenas paginação (`PaginacaoDto`), ao
contrário de `GET /alunos`, que busca por nome, matrícula ou e-mail.

**O que o frontend faz:** a aba Professores de Pessoas só pagina. Não há campo de busca,
porque filtrar no cliente apenas a página atual esconderia resultados das outras.

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
