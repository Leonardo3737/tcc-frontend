import { z } from 'zod';

/**
 * Espelham backend/src/modules/auth/dto/recuperacao-senha.dto.ts.
 *
 * `confirmacao` existe so no cliente (protecao contra erro de digitacao) e nao
 * vai no corpo: o `forbidNonWhitelisted` do backend recusaria o campo.
 */

/** Regras do backend, ditas na tela (recuperacao-senha.service.ts). */
export const VALIDADE_CODIGO_MINUTOS = 15;
export const MAX_TENTATIVAS_CODIGO = 5;

export const esquemaSolicitarRecuperacao = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Informe o seu e-mail')
    .email('Informe um e-mail válido')
    .max(150, 'O e-mail deve ter no máximo 150 caracteres'),
});

export type DadosSolicitarRecuperacao = z.infer<typeof esquemaSolicitarRecuperacao>;

export const esquemaConfirmarRecuperacao = z
  .object({
    // Espacos sao tolerados (o codigo costuma ser colado do e-mail), mas o que
    // vai ao backend sao exatamente 6 digitos.
    codigo: z
      .string()
      .transform((valor) => valor.replace(/\s+/g, ''))
      .pipe(z.string().regex(/^\d{6}$/, 'O código tem exatamente 6 dígitos')),
    novaSenha: z
      .string()
      .min(8, 'A nova senha deve ter ao menos 8 caracteres')
      .max(128, 'A nova senha deve ter no máximo 128 caracteres'),
    confirmacao: z.string(),
  })
  .refine((dados) => dados.novaSenha === dados.confirmacao, {
    path: ['confirmacao'],
    message: 'As senhas não coincidem',
  });

export type DadosConfirmarRecuperacao = z.input<typeof esquemaConfirmarRecuperacao>;
export type DadosConfirmarRecuperacaoValidos = z.output<typeof esquemaConfirmarRecuperacao>;
