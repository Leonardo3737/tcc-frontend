import { Suspense } from 'react';
import type { Metadata } from 'next';

import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { SemAcesso } from '@/components/autorizacao/sem-acesso';
import { SkeletonLista } from '@/components/ui/skeleton';
import { PainelDisciplinas } from '@/features/disciplinas/components/painel-disciplinas';
import { verificarPerfil } from '@/lib/auth/sessao';
import { PerfilUsuario } from '@/types/dominio';

export const metadata: Metadata = { title: 'Disciplinas' };

/**
 * Catálogo — restrito a PROFESSOR, como no backend
 * (`@Perfis(PerfilUsuario.PROFESSOR)` em POST e PATCH de /disciplinas).
 *
 * A leitura em si é liberada a qualquer autenticado no backend, mas esta tela é
 * de manutenção: só faz sentido para quem pode cadastrar e editar.
 */
export default async function PaginaDisciplinas() {
  const { autorizado } = await verificarPerfil(PerfilUsuario.PROFESSOR);

  if (!autorizado) {
    return (
      <SemAcesso descricao="O catálogo de disciplinas é mantido por professores. Fale com a coordenação se precisar de acesso." />
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Disciplinas"
        descricao="Catálogo que dá nome e código às monitorias."
      />

      {/* O painel lê filtros da URL com useSearchParams. */}
      <Suspense fallback={<SkeletonLista itens={4} />}>
        <PainelDisciplinas />
      </Suspense>
    </>
  );
}
