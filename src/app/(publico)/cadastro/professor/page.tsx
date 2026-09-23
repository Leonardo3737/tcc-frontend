import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardConteudo } from '@/components/ui/card';
import { FormularioCadastroProfessor } from '@/features/auth/components/formulario-cadastro-professor';
import { rotas } from '@/config/rotas';

export const metadata: Metadata = { title: 'Cadastro de professor' };

export default function PaginaCadastroProfessor() {
  return (
    <Card>
      <CardConteudo className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-titulo text-titulo-pagina text-texto">Criar conta de professor</h1>
          <p className="text-sm text-texto-suave">
            Professores criam monitorias e habilitam monitores.
          </p>
        </div>

        <FormularioCadastroProfessor />

        <p className="border-t border-borda pt-4 text-center text-sm text-texto-suave">
          Já tem conta?{' '}
          <Link href={rotas.login} className="font-medium text-primaria hover:underline">
            Entrar
          </Link>
        </p>
      </CardConteudo>
    </Card>
  );
}
