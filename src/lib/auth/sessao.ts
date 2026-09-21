import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { apiServidor } from '@/lib/api/servidor';
import { ApiError } from '@/lib/api/erros';
import { rotas } from '@/config/rotas';
import type { PerfilUsuario, Usuario } from '@/types/dominio';

/**
 * Fonte de verdade da sessao.
 *
 * O usuario vem SEMPRE de `GET /usuarios/eu`, nunca de decodificar o JWT no
 * cliente. Isso importa porque o backend recarrega o usuario do banco a cada
 * requisicao: uma conta desativada, ou um perfil que mudou, tem efeito imediato,
 * enquanto o token continuaria dizendo o que dizia quando foi emitido.
 *
 * `cache()` do React deduplica a chamada dentro de uma mesma renderizacao: o
 * layout, o middleware de pagina e qualquer componente podem pedir a sessao sem
 * gerar N requisicoes.
 */
export const obterSessao = cache(async (): Promise<Usuario | null> => {
  try {
    return await apiServidor.get<Usuario>('/usuarios/eu', { cache: 'no-store' });
  } catch (erro) {
    // 401 aqui e o caso normal de "sem sessao" (sem cookie, token expirado ou
    // usuario desativado). Qualquer outra falha e problema de verdade e deve
    // subir, em vez de virar silenciosamente uma tela de login.
    if (erro instanceof ApiError && erro.ehNaoAutenticado) {
      return null;
    }

    throw erro;
  }
});

/**
 * Exige sessao. Usada pelo layout autenticado.
 *
 * Redireciona para o login preservando o destino, para que o usuario volte
 * exatamente para onde tentava ir depois de autenticar.
 */
export async function exigirSessao(destino?: string): Promise<Usuario> {
  const usuario = await obterSessao();

  if (!usuario) {
    const parametros = destino ? `?${new URLSearchParams({ destino })}` : '';
    redirect(`${rotas.login}${parametros}`);
  }

  return usuario;
}

/**
 * Verifica perfil sem redirecionar.
 *
 * Espelha o `@Perfis(...)` do backend, inclusive na semantica: passa quem tiver
 * QUALQUER um dos perfis exigidos, porque o mesmo usuario pode acumular ALUNO e
 * PROFESSOR.
 *
 * Devolve `{ usuario, autorizado }` em vez de redirecionar porque paginas nao
 * sao um bom lugar para `redirect()`: quando a pagina roda, o layout ja comecou
 * a ser transmitido, o Next nao consegue mais responder 307 e cai num
 * `<meta http-equiv="refresh">` de 1 segundo — o usuario ve a tela restrita
 * piscar antes de ser levado embora.
 *
 * Em paginas, use isto e renderize <SemAcesso>. Redirecionar so vale a pena em
 * LAYOUTS, onde a decisao acontece antes do primeiro flush (e por isso
 * `exigirSessao` produz um 307 limpo).
 *
 * Continua sendo UX, nao seguranca: o endpoint responderia 403 de qualquer forma.
 */
export async function verificarPerfil(
  ...perfis: PerfilUsuario[]
): Promise<{ usuario: Usuario; autorizado: boolean }> {
  const usuario = await exigirSessao();

  return {
    usuario,
    autorizado: perfis.some((perfil) => usuario.perfis.includes(perfil)),
  };
}
