import { z } from 'zod';

/** Espelha criar-disciplina.dto.ts e atualizar-disciplina.dto.ts. */

const nome = z
  .string()
  .trim()
  .min(2, 'O nome deve ter ao menos 2 caracteres')
  .max(150, 'O nome deve ter no máximo 150 caracteres');

/**
 * Pelo menos um curso, no máximo 20 — os mesmos limites do `@ArrayMinSize` /
 * `@ArrayMaxSize` do backend. Validar aqui evita uma ida ao servidor para
 * receber de volta algo que a tela já sabia.
 */
const cursosIds = z
  .array(z.string().uuid())
  .min(1, 'Escolha ao menos um curso')
  .max(20, 'No máximo 20 cursos por disciplina');

/**
 * Criar pede nome e cursos: o `codigo` e gerado pelo servidor a partir do nome
 * (ex.: "Calculo I" -> CAL001). Enviar `codigo` devolveria 400 pelo
 * `forbidNonWhitelisted`.
 */
export const esquemaCriarDisciplina = z.object({ nome, cursosIds });

export type DadosCriarDisciplina = z.infer<typeof esquemaCriarDisciplina>;

export const esquemaEditarDisciplina = z.object({
  nome,
  ativa: z.boolean(),
  cursosIds,
});

export type DadosEditarDisciplina = z.infer<typeof esquemaEditarDisciplina>;

export const CAMPOS_DISCIPLINA = ['nome', 'ativa', 'cursosIds'] as const;
