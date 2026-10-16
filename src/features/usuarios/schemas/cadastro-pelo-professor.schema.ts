import { z } from 'zod';

/**
 * Espelham backend/src/modules/usuarios/dto/criar-usuario-pelo-professor.dto.ts.
 *
 * Os limites sao copiados um a um dos decorators do class-validator (Length,
 * Matches, MaxLength). Quando o backend mudar um limite, este arquivo muda
 * junto — e a divergencia aparece como 400 no primeiro teste, nao em producao.
 *
 * NAO HA SENHA: o servidor gera uma aleatoria e a envia ao e-mail da pessoa.
 * Quem cria a conta nunca ve a credencial, e mandar `senhaProvisoria` hoje
 * devolveria 400 (`forbidNonWhitelisted`). Por isso o e-mail e o campo que
 * mais importa aqui: e por ele que a senha chega.
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
  .min(1, 'Informe o e-mail: é para ele que a senha de acesso será enviada')
  .email('Informe um e-mail válido')
  .max(150, 'O e-mail deve ter no máximo 150 caracteres');

/** Mesmo regex do backend: alfanuméricos, ponto, hífen e underscore (3 a 30). */
const REGEX_IDENTIFICADOR = /^[A-Za-z0-9._-]{3,30}$/;
const MENSAGEM_IDENTIFICADOR = 'Use de 3 a 30 caracteres: letras, números, ponto, hífen ou _';

export const esquemaCadastroAluno = z.object({
  nome,
  email,
  matricula: z.string().trim().regex(REGEX_IDENTIFICADOR, MENSAGEM_IDENTIFICADOR),
  /**
   * `cursoId`, nao mais `curso` em texto livre.
   *
   * E OBRIGATORIO: o curso decide de quais monitorias o aluno pode participar,
   * e a coluna do backend nao aceita nulo. A mensagem fala do que a pessoa ve
   * na tela — um campo de escolha —, nao de UUID.
   */
  cursoId: z.string().uuid('Escolha o curso do aluno'),
});

export type DadosCadastroAluno = z.infer<typeof esquemaCadastroAluno>;

export const esquemaCadastroProfessor = z.object({
  nome,
  email,
  identificacaoFuncional: z
    .string()
    .trim()
    .regex(REGEX_IDENTIFICADOR, MENSAGEM_IDENTIFICADOR)
    .optional()
    .or(z.literal('')),
  departamento: z
    .string()
    .trim()
    .max(120, 'O departamento deve ter no máximo 120 caracteres')
    .optional(),
});

export type DadosCadastroProfessor = z.infer<typeof esquemaCadastroProfessor>;

export const CAMPOS_CADASTRO_ALUNO = ['nome', 'email', 'matricula', 'cursoId'] as const;

export const CAMPOS_CADASTRO_PROFESSOR = [
  'nome',
  'email',
  'identificacaoFuncional',
  'departamento',
] as const;

/**
 * Campo responsavel por um 409.
 *
 * O backend traduz as constraints unicas (`usuarios_email_key`,
 * `alunos_matricula_key`, a da identificacao funcional) em frases de dominio.
 * Elas sao a unica pista de QUAL campo colidiu, entao o mapeamento e feito pelo
 * conteudo da mensagem — sem acento e em minusculas, como o backend escreve.
 * Sem correspondencia, o erro fica no topo do formulario.
 */
export function campoDoConflito(
  mensagem: string,
): 'email' | 'matricula' | 'identificacaoFuncional' | null {
  const normalizada = mensagem.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  if (normalizada.includes('e-mail') || normalizada.includes('email')) return 'email';
  if (normalizada.includes('matricula')) return 'matricula';
  if (normalizada.includes('identificacao funcional')) return 'identificacaoFuncional';
  return null;
}
