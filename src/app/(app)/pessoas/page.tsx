import { Suspense } from 'react';
import type { Metadata } from 'next';

import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { SemAcesso } from '@/components/autorizacao/sem-acesso';
import { PainelPessoas, SkeletonPessoas } from '@/features/usuarios/components/painel-pessoas';
import { verificarPerfil } from '@/lib/auth/sessao';
import { PerfilUsuario } from '@/types/dominio';

export const metadata: Metadata = { title: 'Pessoas' };

/**
 * Pessoas — restrito a PROFESSOR, como no backend (`@Perfis(PROFESSOR)` em
 * POST /alunos, POST /professores e GET /alunos).
 *
 * E aqui que contas nascem: nao ha auto-cadastro na plataforma.
 */
export default async function PaginaPessoas() {
  const { autorizado } = await verificarPerfil(PerfilUsuario.PROFESSOR);

  if (!autorizado) {
    return (
      <SemAcesso descricao="O cadastro de pessoas é feito por professores. Se você precisa de uma conta para outra pessoa, peça a um docente da disciplina." />
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Pessoas"
        descricao="Cadastre alunos e professores. As contas só são criadas aqui: não há cadastro pela tela de login."
      />

      {/* O painel le aba, busca e pagina da URL com useSearchParams. */}
      <Suspense fallback={<SkeletonPessoas />}>
        <PainelPessoas />
      </Suspense>
    </>
  );
}
