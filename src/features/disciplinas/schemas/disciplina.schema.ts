import { z } from 'zod';

/** Espelha criar-disciplina.dto.ts e atualizar-disciplina.dto.ts. */

/**
 * Criar pede SO o nome: o `codigo` e gerado pelo servidor a partir dele
 * (ex.: "Calculo I" -> CAL001). Enviar `codigo` hoje devolveria 400 pelo
 * `forbidNonWhitelisted`.
 */
export const esquemaCriarDisciplina = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'O nome deve ter ao menos 2 caracteres')
    .max(150, 'O nome deve ter no máximo 150 caracteres'),
});

export type DadosCriarDisciplina = z.infer<typeof esquemaCriarDisciplina>;

export const esquemaEditarDisciplina = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'O nome deve ter ao menos 2 caracteres')
    .max(150, 'O nome deve ter no máximo 150 caracteres'),
  ativa: z.boolean(),
});

export type DadosEditarDisciplina = z.infer<typeof esquemaEditarDisciplina>;

export const CAMPOS_DISCIPLINA = ['nome', 'ativa'] as const;
