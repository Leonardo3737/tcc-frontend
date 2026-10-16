import { z } from 'zod';

/** Espelha criar-curso.dto.ts e atualizar-curso.dto.ts. */

const nome = z
  .string()
  .trim()
  .min(2, 'O nome deve ter ao menos 2 caracteres')
  .max(150, 'O nome deve ter no máximo 150 caracteres');

/**
 * Criar pede SO o nome: o `codigo` e gerado pelo servidor a partir dele
 * (ex.: "Engenharia de Software" -> ENG001). Enviar `codigo` devolveria 400
 * pelo `forbidNonWhitelisted`.
 */
export const esquemaCriarCurso = z.object({ nome });

export type DadosCriarCurso = z.infer<typeof esquemaCriarCurso>;

export const esquemaEditarCurso = z.object({
  nome,
  ativo: z.boolean(),
});

export type DadosEditarCurso = z.infer<typeof esquemaEditarCurso>;

export const CAMPOS_CURSO = ['nome', 'ativo'] as const;
