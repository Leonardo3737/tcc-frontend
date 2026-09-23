import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardConteudo } from '@/components/ui/card';
import { SkeletonTexto } from '@/components/ui/skeleton';
import { FormularioLogin } from '@/features/auth/components/formulario-login';
import { rotas } from '@/config/rotas';

export const metadata: Metadata = { title: 'Entrar' };

export default function PaginaLogin() {
  return (
    <Card>
      <CardConteudo className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-titulo text-titulo-pagina text-texto">Entrar na plataforma</h1>
          <p className="text-sm text-texto-suave">
            Use o seu e-mail institucional para acessar as suas monitorias.
          </p>
        </div>

        {/*
          Suspense porque o formulario le `searchParams` (destino, expirou) com
          useSearchParams — sem o limite de suspensao, a rota inteira seria
          empurrada para renderizacao dinamica.
        */}
        <Suspense fallback={<SkeletonTexto linhas={4} />}>
          <FormularioLogin />
        </Suspense>

        <div className="space-y-2 border-t border-borda pt-4 text-center text-sm text-texto-suave">
          <p>
            Ainda não tem conta?{' '}
            <Link href={rotas.cadastroAluno} className="font-medium text-primaria hover:underline">
              Cadastre-se como aluno
            </Link>
          </p>
          <p className="text-xs">
            É docente?{' '}
            <Link href={rotas.cadastroProfessor} className="text-primaria hover:underline">
              Cadastro de professor
            </Link>
          </p>
        </div>
      </CardConteudo>
    </Card>
  );
}
