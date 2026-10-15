import { z } from 'zod';

/**
 * Espelha backend/src/modules/atendimentos/dto/atualizar-atendimento.dto.ts.
 *
 * O minimo de vagas depende da sessao: o backend recusa (409) capacidade abaixo
 * dos inscritos ativos. Validar isso aqui poupa a ida ao servidor no caso
 * previsivel; o backend continua sendo a palavra final (alguem pode se inscrever
 * entre a abertura do formulario e o envio).
 */
export const VAGAS_MAXIMAS = 50;

export function esquemaEdicaoAtendimento(inscritosAtivos: number) {
  const minimo = Math.max(1, inscritosAtivos);

  return z.object({
    assunto: z
      .string()
      .trim()
      .min(3, 'O assunto deve ter ao menos 3 caracteres')
      .max(200, 'O assunto deve ter no máximo 200 caracteres'),
    // Vazio e permitido: e assim que se REMOVE o local.
    local: z.string().trim().max(150, 'O local deve ter no máximo 150 caracteres'),
    vagas: z.coerce
      .number({ invalid_type_error: 'Informe um número' })
      .int('Use um número inteiro')
      .min(
        minimo,
        inscritosAtivos > 1
          ? `Já há ${inscritosAtivos} inscritos: as vagas não podem ficar abaixo disso`
          : 'Mínimo de 1 vaga',
      )
      .max(VAGAS_MAXIMAS, `Máximo de ${VAGAS_MAXIMAS} vagas`),
  });
}

export type DadosEdicaoAtendimentoForm = z.input<ReturnType<typeof esquemaEdicaoAtendimento>>;
export type DadosEdicaoAtendimentoValidos = z.output<ReturnType<typeof esquemaEdicaoAtendimento>>;

export const CAMPOS_EDICAO_ATENDIMENTO = ['assunto', 'local', 'vagas'] as const;
