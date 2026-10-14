import type { Metadata } from 'next';

import { Card, CardConteudo } from '@/components/ui/card';
import { FluxoRecuperacaoSenha } from '@/features/auth/components/fluxo-recuperacao-senha';

export const metadata: Metadata = { title: 'Recuperar senha' };

/**
 * Recuperacao de senha — publica e acessivel tambem com sessao (o middleware
 * so tira do login quem ja entrou): Minha conta aponta para ca quando a pessoa
 * nao lembra a senha atual.
 */
export default function PaginaRecuperarSenha() {
  return (
    <Card className="w-full max-w-md">
      <CardConteudo className="sm:p-6">
        <FluxoRecuperacaoSenha />
      </CardConteudo>
    </Card>
  );
}
