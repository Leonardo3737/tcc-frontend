# Verificação de integração

Estes scripts exercitam a aplicação **real**: frontend → cookie httpOnly → proxy →
NestJS → PostgreSQL. Não há mocks — mocks vivem apenas nos testes de unidade
(`test/*.spec.ts`).

## Pré-requisitos

1. PostgreSQL no ar;
2. backend em `http://localhost:3000` (`npm run start:dev` em `../backend`);
3. frontend em `http://localhost:3001` (`npm run dev`);
4. usuários do seeder do backend (`npm run db:seed`):
   `joao.ribeiro@ufx.edu.br` (professor) e `ana.martins@ufx.edu.br` (aluna),
   ambos com senha `senhaSegura123`.

```bash
npm run test:integracao
```

## O que cada script cobre

| Script | Verificações |
|---|---|
| `fluxo-dominio.py` | 27 — ciclo completo: disciplina → monitoria → ativação → habilitação de monitor (RN01) → disponibilidade → agendamento → conflitos (RN03) → reagendamento → materiais (RN08) → indicadores. Inclui os 409 que **são** as regras: RN09, RN03, horário fora da disponibilidade, encerrar com atendimento agendado |
| `seguranca.py` | 27 — os quatro cenários de sessão (professor, aluno, não autenticado, token forjado), atributos do cookie, tentativa de forjar `Authorization` no proxy, autorização por perfil e por participação (RN01, RN07), logout e sanidade das respostas de erro |

## Por que Python e não Playwright

O alvo aqui é o **contrato HTTP e a sessão**, não a renderização — que já é coberta
pelos testes de componente com Testing Library. Um navegador headless
adicionaria uma dependência pesada para verificar exatamente as mesmas
respostas, com mais pontos de falha intermitente.

Se um dia for preciso testar interação visual ponta a ponta (arrastar, focar,
imprimir), Playwright é o próximo passo natural.
