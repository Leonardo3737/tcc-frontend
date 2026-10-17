import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SemAcesso } from '@/components/autorizacao/sem-acesso';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { SkeletonLista } from '@/components/ui/skeleton';
import { PainelEditais } from '@/features/editais/components/painel-editais';
import { verificarPerfil } from '@/lib/auth/sessao';
import { PerfilUsuario } from '@/types/dominio';

export const metadata: Metadata = { title: 'Editais de monitoria' };

/**
 * Gestao de editais e consulta das candidaturas — restrito a PROFESSOR, como no
 * backend (`@Perfis(PROFESSOR)` em /editais e em todo o /inscricoes).
 *
 * A restricao aqui NAO e o que protege os dados: a listagem carrega nome,
 * matricula e e-mail de pessoas que podem nem ter conta, e quem autoriza isso e
 * o backend (AD-F02). Esta barreira e de UX.
 *
 * `verificarPerfil` + <SemAcesso> em vez de `redirect()`: em pagina o redirect
 * degrada para um `<meta http-equiv="refresh">` com um flash de 1 segundo
 * (AD-F03).
 */
export default async function PaginaEditais() {
  const { autorizado } = await verificarPerfil(PerfilUsuario.PROFESSOR);

  if (!autorizado) {
    return (
      <SemAcesso descricao="Os editais de monitoria são conduzidos por professores. Se você quer se candidatar, a inscrição é feita por uma página pública — procure o link na tela de entrada." />
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Editais de monitoria"
        descricao="Abra o processo seletivo e acompanhe as candidaturas recebidas."
      />

      {/* O painel lê filtros da URL com useSearchParams. */}
      <Suspense fallback={<SkeletonLista itens={5} />}>
        <PainelEditais />
      </Suspense>
    </>
  );
}
