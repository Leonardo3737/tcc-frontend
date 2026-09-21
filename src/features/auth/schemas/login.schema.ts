import { z } from 'zod';

/**
 * Espelha backend/src/modules/auth/dto/login.dto.ts.
 *
 * Inclusive as normalizacoes que o backend aplica com @Transform: trim e
 * minusculas no e-mail. Divergir aqui produz o pior tipo de bug — o formulario
 * aprova, a API rejeita, e a mensagem nao aponta o motivo.
 */
export const esquemaLogin = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Informe o seu e-mail')
    .email('Informe um e-mail válido'),

  senha: z.string().min(1, 'Informe a sua senha'),
});

export type DadosLogin = z.infer<typeof esquemaLogin>;

/** Campos usados para mapear `detalhes[]` de volta ao formulario. */
export const CAMPOS_LOGIN = ['email', 'senha'] as const;
