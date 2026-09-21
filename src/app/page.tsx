import { redirect } from 'next/navigation';

import { rotas } from '@/config/rotas';

/**
 * A raiz nao tem conteudo proprio: quem esta autenticado vai para o painel, e
 * quem nao esta e barrado pelo middleware antes de chegar aqui, indo para o login.
 */
export default function PaginaRaiz() {
  redirect(rotas.inicio);
}
