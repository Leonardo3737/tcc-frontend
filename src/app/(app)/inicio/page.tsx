import type { Metadata } from 'next';

import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { DashboardAluno } from '@/features/dashboard/components/dashboard-aluno';
import { DashboardProfessor } from '@/features/dashboard/components/dashboard-professor';
import { exigirSessao } from '@/lib/auth/sessao';
import { PerfilUsuario } from '@/types/dominio';

export const metadata: Metadata = { title: 'Início' };

/**
 * Painel inicial.
 *
 * Os dois dashboards são renderizados quando o usuário acumula os dois perfis
 * (o schema do backend permite: `perfis` é derivado da existência das linhas em
 * `alunos`/`professores`). Não há seletor de "modo" — a pessoa é as duas coisas
 * ao mesmo tempo, e obrigá-la a alternar inventaria uma separação que o domínio
 * não tem.
 */
export default async function PaginaInicio() {
  const usuario = await exigirSessao();

  const ehProfessor = usuario.perfis.includes(PerfilUsuario.PROFESSOR);
  const ehAluno = usuario.perfis.includes(PerfilUsuario.ALUNO);
  const acumulaPerfis = ehProfessor && ehAluno;

  const primeiroNome = usuario.nome.split(' ')[0];

  return (
    <>
      <CabecalhoPagina
        titulo={`Olá, ${primeiroNome}`}
        descricao={
          acumulaPerfis
            ? 'Você atua como professor e como aluno na plataforma.'
            : ehProfessor
              ? 'Acompanhe as monitorias sob sua responsabilidade.'
              : 'Acompanhe suas monitorias e atendimentos.'
        }
      />

      <div className="space-y-8">
        {ehProfessor && (
          <section aria-label="Painel do professor">
            {acumulaPerfis && (
              <h2 className="mb-3 text-base font-semibold text-texto">Como professor</h2>
            )}
            <DashboardProfessor />
          </section>
        )}

        {ehAluno && (
          <section aria-label="Painel do aluno">
            {acumulaPerfis && (
              <h2 className="mb-3 border-t border-borda pt-6 text-base font-semibold text-texto">
                Como aluno
              </h2>
            )}
            <DashboardAluno />
          </section>
        )}
      </div>
    </>
  );
}
