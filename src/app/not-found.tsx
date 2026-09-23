import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

import { classesBotao } from '@/components/ui/button';
import { rotas } from '@/config/rotas';

export default function NaoEncontrado() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <FileQuestion className="h-10 w-10 text-texto-suave" aria-hidden />

      <div className="space-y-1">
        <h1 className="font-titulo text-titulo-pagina text-texto">Página não encontrada</h1>
        <p className="text-sm text-texto-suave">
          O endereço acessado não existe ou o conteúdo foi removido.
        </p>
      </div>

      <Link href={rotas.inicio} className={classesBotao()}>
        Voltar ao início
      </Link>
    </div>
  );
}
