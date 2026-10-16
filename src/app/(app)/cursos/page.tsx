import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SemAcesso } from '@/components/autorizacao/sem-acesso';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { SkeletonLista } from '@/components/ui/skeleton';
import { PainelCursos } from '@/features/cursos/components/painel-cursos';
import { verificarPerfil } from '@/lib/auth/sessao';
import { PerfilUsuario } from '@/types/dominio';

export const metadata: Metadata = { title: 'Cursos' };

/**
 * Catálogo de cursos — restrito a PROFESSOR, como no backend
 * (`@Perfis(PerfilUsuario.PROFESSOR)` em POST e PATCH de /cursos).
 *
 * A leitura em si é liberada a qualquer autenticado no backend, mas esta tela é
 * de manutenção: só faz sentido para quem pode cadastrar e editar. A barreira
 * aqui é de UX; quem autoriza de fato continua sendo o backend (AD-F02).
 *
 * `verificarPerfil` + <SemAcesso> em vez de `redirect()`: em página o redirect
 * degrada para um `<meta http-equiv="refresh">` com um flash de 1 segundo
 * (AD-F03).
 */
export default async function PaginaCursos() {
  const { autorizado } = await verificarPerfil(PerfilUsuario.PROFESSOR);

  if (!autorizado) {
    return (
      <SemAcesso descricao="O catálogo de cursos é mantido por professores. Fale com a coordenação se precisar de acesso." />
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Cursos"
        descricao="Base do catálogo: toda disciplina é oferecida por um ou mais cursos, e todo aluno pertence a um."
      />

      {/* O painel lê filtros da URL com useSearchParams. */}
      <Suspense fallback={<SkeletonLista itens={4} />}>
        <PainelCursos />
      </Suspense>
    </>
  );
}
