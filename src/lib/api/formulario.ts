import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError, mensagemDeErro, separarErrosPorCampo } from './erros';

/**
 * Devolve um erro da API para dentro do formulario.
 *
 * Concentra o padrao que se repetiria em todos os formularios do sistema:
 *
 *  - 400 com `detalhes[]` (ValidationPipe): cada mensagem volta para o seu campo;
 *  - 409 (conflito de dominio — RN03, RN09, transicao invalida, sem vagas):
 *    vai para `root`, porque nao pertence a um campo especifico e o usuario
 *    precisa continuar lendo enquanto ajusta o formulario;
 *  - demais: `root`, com o texto ja tratado por `mensagemDeErro`.
 *
 * `camposEspeciais` permite direcionar um status inteiro para um campo, quando
 * aquele status so pode significar um problema naquele campo.
 */
export function aplicarErroDeFormulario<T extends FieldValues>(
  erro: unknown,
  setError: UseFormSetError<T>,
  camposConhecidos: readonly string[],
  camposEspeciais?: Partial<Record<number, Path<T>>>,
): void {
  if (!(erro instanceof ApiError)) {
    setError('root' as Path<T>, {
      type: 'server',
      message: mensagemDeErro(erro),
    });
    return;
  }

  const campoEspecial = camposEspeciais?.[erro.statusCode];

  if (campoEspecial) {
    setError(campoEspecial, { type: 'server', message: erro.message });
    return;
  }

  if (erro.ehValidacao && erro.detalhes.length > 0) {
    const { porCampo, gerais } = separarErrosPorCampo(erro.detalhes, camposConhecidos);

    for (const [campo, mensagem] of Object.entries(porCampo)) {
      setError(campo as Path<T>, { type: 'server', message: mensagem });
    }

    if (gerais.length > 0) {
      setError('root' as Path<T>, { type: 'server', message: gerais.join(' ') });
    }

    return;
  }

  setError('root' as Path<T>, { type: 'server', message: mensagemDeErro(erro) });
}
