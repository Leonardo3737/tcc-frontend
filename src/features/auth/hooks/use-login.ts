'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { entrar } from '../api/auth.service';
import { CAMPOS_LOGIN, type DadosLogin } from '../schemas/login.schema';
import { ApiError, mensagemDeErro, separarErrosPorCampo } from '@/lib/api/erros';
import { rotas } from '@/config/rotas';

/**
 * Aceita apenas destinos internos.
 *
 * Sem esta checagem, `?destino=https://site-malicioso` transformaria o login em
 * open redirect — a vitima autentica de verdade e e jogada em uma pagina de
 * phishing que parece continuacao do fluxo. `//host` tambem e barrado: o
 * navegador o interpreta como URL absoluta com protocolo relativo.
 */
function destinoSeguro(bruto: string | null): string {
  if (!bruto) return rotas.inicio;
  if (!bruto.startsWith('/') || bruto.startsWith('//')) return rotas.inicio;
  return bruto;
}

export function useLogin(setError: UseFormSetError<DadosLogin>) {
  const router = useRouter();
  const parametros = useSearchParams();

  const mutacao = useMutation({
    mutationFn: entrar,

    onSuccess: () => {
      const destino = destinoSeguro(parametros.get('destino'));

      /**
       * `replace` para que o botao "voltar" nao retorne ao login, e `refresh`
       * para que os Server Components sejam renderizados de novo — agora com o
       * cookie de sessao presente.
       */
      router.replace(destino);
      router.refresh();
    },

    onError: (erro: unknown) => {
      if (!(erro instanceof ApiError)) return;

      // 400: o ValidationPipe devolve `detalhes[]`; devolvemos cada um ao campo.
      if (erro.ehValidacao && erro.detalhes.length > 0) {
        const { porCampo, gerais } = separarErrosPorCampo(erro.detalhes, CAMPOS_LOGIN);

        for (const [campo, mensagem] of Object.entries(porCampo)) {
          setError(campo as keyof DadosLogin, { type: 'server', message: mensagem });
        }

        if (gerais.length > 0) {
          setError('root', { type: 'server', message: gerais.join(' ') });
        }

        return;
      }

      /**
       * 401 nunca vai para um campo especifico: o backend responde
       * "Credenciais invalidas" sem dizer se foi o e-mail ou a senha, para nao
       * permitir enumeracao de contas. Marcar o campo errado aqui desfaria essa
       * protecao no cliente.
       *
       * `mensagemDeErro` e quem decide o texto: ele repassa a mensagem do
       * backend (ja escrita para o usuario final) e substitui apenas os casos em
       * que ela nao ajudaria — 429, cujo texto do throttler e
       * "ThrottlerException: Too Many Requests", e 5xx, que nao deve vazar
       * detalhe interno.
       */
      setError('root', { type: 'server', message: mensagemDeErro(erro) });
    },
  });

  return mutacao;
}
