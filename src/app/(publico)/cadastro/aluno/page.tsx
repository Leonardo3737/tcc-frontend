import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardConteudo } from '@/components/ui/card';
import { FormularioCadastroAluno } from '@/features/auth/components/formulario-cadastro-aluno';
import { rotas } from '@/config/rotas';

export const metadata: Metadata = { title: 'Cadastro de aluno' };

export default function PaginaCadastroAluno() {
  return (
    <Card>
      <CardConteudo className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-titulo text-titulo-pagina text-texto">Criar conta de aluno</h1>
          <p className="text-sm text-texto-suave">
            Depois de entrar, você poderá participar das monitorias das suas disciplinas.
          </p>
        </div>

        <FormularioCadastroAluno />

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
