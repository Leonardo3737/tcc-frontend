import type { Metadata } from 'next';

import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Card, CardConteudo } from '@/components/ui/card';
import { SemAcesso } from '@/components/autorizacao/sem-acesso';
import { FormularioNovaMonitoria } from '@/features/monitorias/components/formulario-nova-monitoria';
import { verificarPerfil } from '@/lib/auth/sessao';
import { PerfilUsuario } from '@/types/dominio';

export const metadata: Metadata = { title: 'Nova monitoria' };

/**
 * Criação de monitoria — restrita a PROFESSOR (`@Perfis(PROFESSOR)` no backend).
 *
 * O professor responsável é sempre o usuário autenticado: o backend ignora
 * qualquer `professorId` que viesse no corpo, porque aceitá-lo permitiria criar
 * monitoria em nome de outro docente e, por tabela, habilitar monitores no lugar
 * dele (RN01).
 */
export default async function PaginaNovaMonitoria() {
  const { autorizado } = await verificarPerfil(PerfilUsuario.PROFESSOR);

  if (!autorizado) {
    return <SemAcesso descricao="Apenas professores criam monitorias." />;
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Nova monitoria"
        descricao="Você será o professor responsável por esta oferta."
      />

      <Card className="max-w-2xl">
        <CardConteudo>
          <FormularioNovaMonitoria />
        </CardConteudo>
      </Card>
    </>
  );
}
