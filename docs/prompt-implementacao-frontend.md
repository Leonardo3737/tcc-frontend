# Prompt: Completar funcionalidades e redesenhar a experiência do frontend

> Copie o bloco abaixo inteiro e envie em uma nova conversa, com as pastas `frontend/` e
> `backend/` abertas. Ele é autocontido e não depende do histórico desta conversa.

---

Estamos desenvolvendo o TCC "Proposta de uma Plataforma Digital para Apoio à Monitoria no
Ensino Superior". O backend (NestJS + Sequelize + PostgreSQL) está pronto em `backend/` e
documentado em `backend/docs/arquitetura.md`. O frontend (Next.js 15 + React 19 + TypeScript +
Tailwind 3 + TanStack Query + react-hook-form/zod + Radix) está em `frontend/` e já cobre a
maior parte do domínio.

Tenho dois objetivos:

1. **Completar as funcionalidades** que o backend já oferece e o frontend ainda não expõe.
2. **Redesenhar a experiência.** Hoje a interface parece um conjunto de CRUDs com a paleta
   padrão do Tailwind (slate + azul), com cara de "feito por IA". Quero um sistema com
   identidade visual própria, com informação clara e objetiva, organizado em torno do que a
   pessoa precisa **fazer**, e não das tabelas do banco.

## Regras de trabalho

1. **Leia antes de mudar.** Antes de cada bloco, leia os arquivos envolvidos e o controller
   correspondente no backend. Se algo que descrevo aqui estiver errado em relação ao código,
   diga isso e não implemente sobre um diagnóstico errado.
2. **Não altere o backend.** Se uma funcionalidade depender de um endpoint que não existe,
   pare e me diga. Não simule o dado no cliente. Isso já está registrado em
   `frontend/docs/limitacoes-da-api.md`; mantenha esse arquivo atualizado.
3. **Respeite a arquitetura atual do frontend:**
   - chamadas HTTP apenas em `src/features/*/api/*.service.ts`;
   - chaves de cache centralizadas em `src/lib/query/chaves.ts`;
   - regras de "quem pode o quê" apenas em `src/lib/autorizacao/capacidades.ts` (é UX,
     espelho do backend; nada de `if (perfil === ...)` espalhado nos componentes);
   - todo instante é montado com o fuso vindo de `GET /api/configuracao`
     (`src/lib/datas/fuso.ts`), nunca com o fuso do navegador;
   - o backend usa `forbidNonWhitelisted`: não envie campos que o DTO não declara;
   - não existe DELETE na API (RN10); a UI fala em "encerrar", "desativar", "remover", nunca
     em "excluir".
4. **Mantenha o estilo do código:** nomes em português, comentários explicando o *porquê*,
   componentes pequenos e sem regra de negócio duplicada.
5. **Ao fim de cada bloco:** rode `npm run lint`, `npm run typecheck`, `npm run test` e
   `npm run build`. Abra a aplicação no navegador (`npm run dev`, porta 3001, com o backend
   rodando), percorra os fluxos alterados como ALUNO-monitor, ALUNO-monitorado e PROFESSOR,
   em desktop e em largura de celular (375px), e me mostre o resultado antes de seguir.
6. Se uma escolha for de produto e não técnica, pare e me pergunte.

## Ordem de execução

**Bloco A (fundação visual) → Bloco B (funcionalidades faltantes) → Bloco C (experiência
orientada a tarefas) → Bloco D (refinamentos e acabamento).**

A fundação visual vem primeiro para que as telas novas já nasçam no padrão novo e não
precisem ser refeitas.

---

# BLOCO A: Fundação visual e identidade

Os tokens já estão em `src/app/globals.css` (variáveis RGB) e `tailwind.config.ts`. Trocar o
tema é trocar essas variáveis, e os componentes em `src/components/ui/` devem continuar
consumindo apenas os tokens.

## A1. Paleta com personalidade

Substitua o slate + azul-700 genérico por uma paleta própria. Proposta (ajuste se tiver
motivo, mas justifique):

- **Primária:** azul-petróleo / teal escuro (algo próximo de `#0F5E63`), sóbrio e acadêmico,
  mas longe do azul padrão.
- **Acento:** âmbar/coral quente (algo próximo de `#E8793A`), usado com parcimônia para
  destacar o que pede ação (próximo atendimento, avaliação pendente, vaga disponível).
- **Neutros quentes** em vez de slate frio: fundo levemente off-white (tipo `#F7F5F0`),
  superfície branca, bordas e texto suave com um leve tom quente.
- **Cores de papel contextual**, consistentes no sistema inteiro:
  MONITOR = violeta/índigo; MONITORADO = teal claro; PROFESSOR RESPONSÁVEL = âmbar/terracota.
  O papel é o conceito central do domínio (a mesma pessoa é MONITOR em uma monitoria e
  MONITORADO em outra), então ele precisa ser reconhecível de relance.
- **Cores de status** com semântica fixa: AGENDADO (azul-petróleo), REALIZADO (verde),
  CANCELADO (cinza, com texto riscado ou esmaecido, não vermelho gritante), AUSENTE (âmbar),
  PLANEJADA / ATIVA / ENCERRADA / CANCELADA da monitoria com a mesma lógica.
- **Cor por disciplina:** derive, a partir do `codigo` da disciplina, um matiz estável de uma
  paleta de 8 cores harmônicas (hash → índice). Use em uma faixa lateral ou em um ícone de
  iniciais nos cartões de monitoria e atendimento, para a pessoa localizar "Cálculo I" pela
  cor sem ler.
- Todos os pares texto/fundo com contraste **WCAG AA**. A cor nunca é a única portadora de
  informação: sempre há também um rótulo ou ícone.

## A2. Tipografia

- Use `next/font` com uma fonte de títulos com caráter (por exemplo, *Bricolage Grotesque*,
  *Fraunces* ou *Plus Jakarta Sans*) e uma fonte de texto muito legível (por exemplo, *Inter*
  ou *Source Sans 3*). Escolha e justifique.
- Escala tipográfica definida (títulos de página, seção, cartão, corpo, legenda) e aplicada de
  forma consistente.
- Números (horários, vagas, pontos, médias) com `tabular-nums`.

## A3. Componentes base

Revise `src/components/ui/*` com a nova linguagem:

- botões com hierarquia clara (primário único por tela, secundário, fantasma, perigo);
- badges de papel e de status usando os tokens de A1;
- cartões com menos borda e sombra genérica, mais uso de espaço e de faixa de cor;
- estados vazios com ilustração leve (SVG simples ou ícone grande) **e uma ação concreta**;
- skeletons com o mesmo formato do conteúdo final;
- um componente `BarraVagas` ("3 de 5 vagas", com barra de preenchimento);
- um componente `DataRelativa` ("hoje, 14:00", "amanhã", "qui, 25/09", "em 2 h").

## A4. O que evitar (a "cara de IA")

- gradientes roxo→azul, glassmorphism, brilhos e sombras exageradas;
- emojis decorativos e saudações do tipo "Bem-vindo de volta! 👋";
- um ícone ao lado de cada título;
- grades de cartões idênticos para tudo;
- textos de marketing, frases vagas ("Gerencie tudo em um só lugar") e redundâncias;
- tabelas quando a pessoa precisa de uma resposta e não de um registro;
- centralizar tudo e deixar grandes vazios sem propósito.

A interface deve parecer uma ferramenta de trabalho bem pensada da universidade, não um
template de landing page.

---

# BLOCO B: Funcionalidades que o backend oferece e o frontend não expõe

## B1. Cadastro de usuários pelo professor

**Backend:** `POST /api/alunos` (`nome`, `email`, `senhaProvisoria`, `matricula`, `curso?`) e
`POST /api/professores` (`nome`, `email`, `senhaProvisoria`, `identificacaoFuncional?`,
`departamento?`), ambos `@Perfis(PROFESSOR)`. DTOs em
`backend/src/modules/usuarios/dto/criar-usuario-pelo-professor.dto.ts`.

**Implementar:**

- nova seção **"Pessoas"** no menu, visível só para PROFESSOR, com abas *Alunos* e
  *Professores*;
- listagem de alunos (`GET /alunos`, busca por nome, matrícula ou e-mail) e de professores
  (`GET /professores`);
- ação "Cadastrar aluno" / "Cadastrar professor" em diálogo, com validação zod espelhando o
  DTO (`matricula` com o mesmo regex, `senhaProvisoria` de 8 a 128 caracteres);
- botão "Gerar senha provisória" que preenche uma senha aleatória legível;
- após criar: tela de confirmação clara com e-mail e senha provisória, botão "Copiar dados de
  acesso" e o aviso **"Oriente a pessoa a trocar a senha no primeiro acesso, em Minha conta."**
  (o backend ainda não força a troca; não finja que força);
- 409 (e-mail, matrícula ou identificação já cadastrados) mostrado no campo certo;
- a partir do diálogo de "Adicionar participante" de uma monitoria, se o aluno buscado não
  existir, oferecer o atalho "Cadastrar novo aluno", que cria e já habilita/inscreve na
  monitoria.

## B2. Perfil de outra pessoa

**Backend:** `GET /alunos/:usuarioId` (professor ou o próprio) e `GET /professores/:usuarioId`
(qualquer autenticado).

**Implementar:** página de perfil simples (nome, e-mail, matrícula/curso ou
departamento/identificação), acessível ao clicar no nome de um participante ou do professor
responsável. Para o professor responsável, mostre também as monitorias que ele oferece
(`GET /monitorias?professorId=`).

## B3. Avaliações recebidas pelo monitor

**Backend:** `GET /monitorias/:monitoriaId/monitores/:participanteId/avaliacoes` (resumo com
média e lista). A função `listarAvaliacoesDoMonitor` já existe em
`src/features/avaliacoes/api/avaliacoes.service.ts`, mas nenhum componente a usa.

**Implementar:**

- para o **monitor**: bloco "Como seus atendimentos foram avaliados" na visão geral da
  monitoria (média, distribuição de notas de 1 a 5 em barras e comentários recentes);
- para o **professor responsável**: o mesmo bloco por monitor, na aba Indicadores, ao expandir
  a linha do monitor;
- **sem autoria:** a API não devolve quem avaliou (D-10), e a UI não deve sugerir que sabe.
- Confirme no service do backend quem pode ler esta rota e ajuste `capacidades.ts` se preciso.

## B4. Disponibilidade visível antes de participar

**Backend:** `GET /monitorias/:id/disponibilidades` é aberto a qualquer autenticado,
justamente para o aluno avaliar os horários **antes** de se inscrever na monitoria. Hoje a aba
só aparece para participantes (`cabecalho-monitoria.tsx`).

**Implementar:** na visão geral de uma monitoria em que o aluno ainda não participa, mostrar
"Quando os monitores atendem" (grade semanal de B-C3) ao lado do botão "Participar desta
monitoria". Confirme no backend o que `GET /monitorias/:id` devolve para não participantes.

---

# BLOCO C: Experiência orientada a tarefas (deixar de ser "vários CRUDs")

O princípio: **cada tela responde primeiro "o que eu preciso fazer agora?"** e só depois
mostra registros.

## C1. Início como central de ações

Reescreva `dashboard-aluno.tsx` e `dashboard-professor.tsx`.

**Aluno**, nesta ordem:

1. **Próximo atendimento** em destaque: disciplina (com a cor), horário relativo ("hoje às
   14:00, em 2 h"), local ou link, modalidade, papel da pessoa nele e ação principal (entrar
   no link remoto, ver detalhes, cancelar inscrição);
2. **"Pendências"** em lista curta e acionável: avaliações a fazer, atendimentos que o monitor
   já passou do horário e não registrou como realizados, sessões com vaga abertas nas
   monitorias em que participa;
3. **Minhas monitorias** agrupadas por papel ("Onde sou monitor" / "Onde sou monitorado"),
   com as cores de papel;
4. pontos do semestre em uma linha discreta, não um cartão gigante.

**Professor:**

1. **Checklist de cada monitoria PLANEJADA** mostrando o que falta para ela funcionar:
   `Criada ✓ → Monitor habilitado → Disponibilidade declarada → Ativada`, com o botão da
   próxima etapa. Derive cada item de dados existentes (participantes com papel MONITOR,
   disponibilidades ativas, status);
2. **Alertas:** monitoria ATIVA sem monitor, monitor sem disponibilidade, atendimentos
   passados ainda AGENDADOS, média de avaliação baixa;
3. indicadores (`/analytics/resumo`), com alternância "Minhas monitorias / Plataforma
   inteira" (`apenasMinhas`).

Estados vazios sempre com o próximo passo ("Você ainda não participa de nenhuma monitoria.
Veja as monitorias abertas neste semestre →").

## C2. Agenda em vez de lista

Em "Meus atendimentos" e na aba Atendimentos da monitoria:

- agrupar por dia com cabeçalhos "Hoje", "Amanhã", "Quinta, 25 de setembro";
- linha do tempo compacta por atendimento: horário à esquerda, disciplina com a cor,
  assunto, `BarraVagas`, papel da pessoa e status;
- alternância "Lista / Semana" (visão semanal em grade de dias × horas);
- filtros por período (`de`/`ate`), por monitor (`monitorParticipanteId`) e ordenação
  (`ordenarPor`/`direcao`), todos já suportados pela API e refletidos na URL
  (`use-filtros-url.ts`).

## C3. Disponibilidade como grade semanal

Troque a lista de faixas por uma **grade semanal visual** (colunas = dias, linhas = horas),
com as faixas ativas como blocos coloridos por monitor.

- O monitor cria uma faixa **clicando e arrastando** na grade (com alternativa por formulário
  para teclado e acessibilidade);
- "Editar" continua sendo desativar e criar outra (não existe PATCH), mas apresentado de forma
  honesta: "Substituir faixa";
- a mesma grade, só leitura, aparece para monitorados e não participantes (B4).

## C4. Agendamento por escolha de horário

No `formulario-agendamento.tsx`, em vez de pedir data e hora digitadas:

1. escolher o monitor (com a média de avaliação dele, se disponível);
2. ver os próximos dias com os **horários sugeridos**, derivados da disponibilidade semanal
   dentro dos limites de `GET /configuracao` (duração mínima/máxima, antecedência mínima);
3. clicar em um horário e só então preencher assunto, modalidade e local;
4. resumo final antes de confirmar ("Terça, 30/09, 14:00–15:00 com Ana, presencial, sala
   B12").

O backend continua sendo a validação final (conflito é 409); a sugestão é apenas conveniência.
Mantenha o campo manual como alternativa ("Outro horário").

## C5. Detalhe do atendimento

- Cabeçalho com status grande e em linguagem natural ("Agendado para amanhã às 14:00",
  "Realizado em 20/09, 4 de 5 presentes", "Cancelado por Ana: motivo...");
- **Registrar presença** como lista de chamada com marcação rápida (todos presentes por
  padrão, clique para marcar ausente);
- histórico como linha do tempo vertical;
- a ação principal disponível para aquela pessoa em destaque; as demais em menu secundário.

## C6. Linguagem

- Frases curtas, voz ativa, segunda pessoa ("Você é monitor aqui").
- Nada de jargão do modelo na tela: nunca "participante", "vínculo" ou "inscrição" onde
  "aluno", "participação" e "vaga" servem.
- Toda ação irreversível ou com efeito em outras pessoas mostra a consequência antes ("3
  alunos inscritos serão avisados pelo cancelamento" só se isso for verdade; se não houver
  notificação, diga "os inscritos verão o atendimento como cancelado").
- Mensagens de erro do backend (409 de conflito, RN09 etc.) traduzidas para a próxima ação
  possível, e não apenas repetidas.

---

# BLOCO D: Refinamentos e acabamento

1. **Filtros do catálogo de monitorias:** disciplina, professor, ano e semestre (a API aceita
   `disciplinaId`, `professorId`, `ano`, `semestre`), como chips removíveis e na URL.
2. **Navegação:** breadcrumbs dentro de monitoria e atendimento; a aba ativa sempre visível no
   celular (rolagem horizontal das abas).
3. **Feedback:** toasts curtos para sucesso; atualização otimista nas ações rápidas
   (inscrever, marcar presença) com rollback em erro; botões com estado de carregamento.
4. **Microinterações discretas** (150–200 ms) em hover, abertura de diálogos e troca de abas,
   respeitando `prefers-reduced-motion`, que já está no CSS.
5. **Responsividade:** todas as telas usáveis em 375px; tabelas viram listas empilhadas no
   celular.
6. **Acessibilidade:** navegação completa por teclado, foco visível (já existe), rótulos em
   ícones-botão, contraste AA verificado.
7. **Limpeza:** remova do código as funções de service que continuarem sem uso depois de tudo
   (`detalharDisciplina`, `buscarUsuarioAtual`, `listarHistorico` e `detalharMonitoria` estão
   sem uso hoje) ou justifique mantê-las.
8. **Testes:** acrescente testes (Vitest + Testing Library) para: cadastro de usuário pelo
   professor, derivação dos horários sugeridos (C4), checklist da monitoria (C1), cor estável
   por disciplina (A1) e as novas regras em `capacidades.ts`.
9. **Documentação:** atualize `frontend/README.md` e `frontend/docs/decisoes-arquiteturais.md`
   com as decisões de design (paleta, tipografia, princípio "tarefa antes de registro") e
   `frontend/docs/limitacoes-da-api.md` com qualquer limitação nova encontrada.

---

## Fora de escopo (não implementar; dependem do backend)

- **Upload e download de arquivo em materiais:** não existe `StorageService` nem endpoint.
  Continue apenas com links.
- **Forçar troca de senha no primeiro acesso:** o backend não tem `deveTrocarSenha`. Apenas
  oriente, como em B1.
- **Notificações por e-mail, lista de espera, avaliações pendentes como endpoint:** não
  existem. Não simule.

Se, ao longo do trabalho, alguma dessas ausências impedir uma experiência boa, registre em
`limitacoes-da-api.md` e me avise no fim do bloco.
