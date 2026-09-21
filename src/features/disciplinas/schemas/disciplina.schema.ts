import { z } from 'zod';

/** Espelha criar-disciplina.dto.ts e atualizar-disciplina.dto.ts. */

export const esquemaCriarDisciplina = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Za-z0-9.-]{2,20}$/, 'De 2 a 20 caracteres: letras, números, ponto ou hífen'),
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

export const CAMPOS_DISCIPLINA = ['codigo', 'nome', 'ativa'] as const;
