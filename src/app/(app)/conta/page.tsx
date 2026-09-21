import type { Metadata } from 'next';

import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { FormularioPerfil } from '@/features/usuarios/components/formulario-perfil';
import { FormularioSenha } from '@/features/usuarios/components/formulario-senha';

export const metadata: Metadata = { title: 'Minha conta' };

export default function PaginaConta() {
  return (
    <>
      <CabecalhoPagina
        titulo="Minha conta"
        descricao="Seus dados de identidade na plataforma."
      />

      <div className="space-y-6">
        <Card>
          <CardCabecalho
            titulo="Dados pessoais"
            descricao="Identidade institucional e informações de contato."
          />
          <CardConteudo>
            <FormularioPerfil />
          </CardConteudo>
        </Card>

        <Card>
          <CardCabecalho
            titulo="Segurança"
            descricao="Alterar a senha exige informar a senha atual."
          />
          <CardConteudo>
            <FormularioSenha />
          </CardConteudo>
        </Card>
      </div>
    </>
  );
}
