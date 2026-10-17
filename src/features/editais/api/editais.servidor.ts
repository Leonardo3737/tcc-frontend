import 'server-only';

import { apiPublica } from '@/lib/api/servidor';
import type { RespostaPaginada } from '@/types/api';
import type { EditalPublico } from '@/types/dominio';

/**
 * Editais abertos, do SERVIDOR.
 *
 * Existe para a tela de login, que e renderizada sem sessao e precisa saber se
 * ha inscricao aberta ANTES do primeiro byte — um destaque que aparece depois,
 * por consulta do cliente, empurraria o formulario para baixo com a pagina ja
 * na tela.
 *
 * Usa `apiPublica`: a rota e anonima, e mandar Authorization nela apagaria a
 * distincao entre chamada autenticada e anonima que o projeto mantem de
 * proposito.
 *
 * CACHE de 5 minutos, com tag. O recorte "aberto" muda por VIRADA DE DIA no
 * fuso da instituicao, nao a cada minuto: cinco minutos de defasagem na
 * vespera do prazo nao muda nada para ninguem, e revalidar a cada visita
 * custaria uma requisicao por carregamento da tela mais acessada do sistema.
 */
export async function buscarEditaisAbertos(): Promise<EditalPublico[]> {
  try {
    const resposta = await apiPublica.get<RespostaPaginada<EditalPublico>>('/editais/abertos', {
      // O destaque precisa saber se existe ALGUM; a tela de inscricao lista o resto.
      query: { limite: 10 },
      next: { revalidate: 300, tags: ['editais-abertos'] },
    });

    return resposta.dados;
  } catch {
    /**
     * Um destaque opcional nao pode derrubar o login.
     *
     * Sem a lista, a consequencia e apenas nao anunciar a novidade — bem menos
     * grave do que uma tela de erro no lugar do formulario de entrada. A falha
     * e absorvida aqui, e nao em cada chamador.
     */
    return [];
  }
}
