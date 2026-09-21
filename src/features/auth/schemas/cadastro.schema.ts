import { z } from 'zod';

/**
 * Espelham backend/src/modules/auth/dto/registrar-{aluno,professor}.dto.ts.
 *
 * Os limites sao copiados um a um dos decorators do class-validator (Length,
 * Matches, MaxLength). Quando o backend mudar um limite, este arquivo muda
 * junto — e a divergencia aparece como erro 400 no primeiro teste, nao em
 * producao.
 */

const nome = z
  .string()
  .trim()
  .min(3, 'O nome deve ter ao menos 3 caracteres')
  .max(150, 'O nome deve ter no máximo 150 caracteres');

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Informe o seu e-mail')
  .email('Informe um e-mail válido')
  .max(150, 'O e-mail deve ter no máximo 150 caracteres');

const senha = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres');

/** O backend aceita alfanuméricos, ponto, hífen e underscore (3 a 30). */
const identificador = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{3,30}$/, 'Use de 3 a 30 caracteres: letras, números, ponto, hífen ou _');

export const esquemaCadastroAluno = z
  .object({
    nome,
    email,
    senha,
    confirmacaoSenha: z.string(),
    matricula: identificador,
    curso: z.string().trim().max(120, 'O curso deve ter no máximo 120 caracteres').optional(),
  })
  /**
   * A confirmacao existe so no cliente: o backend nao a conhece e nao deve
   * conhecer. E uma protecao contra erro de digitacao, nao uma regra de dominio.
   */
  .refine((dados) => dados.senha === dados.confirmacaoSenha, {
    path: ['confirmacaoSenha'],
    message: 'As senhas não coincidem',
  });

export type DadosCadastroAluno = z.infer<typeof esquemaCadastroAluno>;

export const esquemaCadastroProfessor = z
  .object({
    nome,
    email,
    senha,
    confirmacaoSenha: z.string(),
    identificacaoFuncional: identificador.optional().or(z.literal('')),
    departamento: z
      .string()
      .trim()
      .max(120, 'O departamento deve ter no máximo 120 caracteres')
      .optional(),
    /**
     * Obrigatorio apenas quando o servidor tem CODIGO_CADASTRO_PROFESSOR
     * configurado — o que o cliente nao tem como saber. Por isso e opcional
     * aqui, e o 403 do backend e tratado como erro de campo.
     */
    codigoCadastro: z.string().trim().optional(),
  })
  .refine((dados) => dados.senha === dados.confirmacaoSenha, {
    path: ['confirmacaoSenha'],
    message: 'As senhas não coincidem',
  });

export type DadosCadastroProfessor = z.infer<typeof esquemaCadastroProfessor>;

export const CAMPOS_CADASTRO_ALUNO = ['nome', 'email', 'senha', 'matricula', 'curso'] as const;

export const CAMPOS_CADASTRO_PROFESSOR = [
  'nome',
  'email',
  'senha',
  'identificacaoFuncional',
  'departamento',
  'codigoCadastro',
] as const;
