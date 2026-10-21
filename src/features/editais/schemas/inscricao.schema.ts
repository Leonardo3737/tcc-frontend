import { z } from 'zod';

import { Turno } from '@/types/dominio';

/** Espelha criar-inscricao.dto.ts e os limites do upload no service do backend. */

/** `LIMITE_BOLETIM_BYTES` do backend. Repetido aqui para validar antes do envio. */
export const LIMITE_BOLETIM_BYTES = 5 * 1024 * 1024;
export const MIME_PDF = 'application/pdf';

/**
 * Nota opcional, de 0 a 10, com ate 2 casas.
 *
 * O ponto delicado: campo VAZIO significa "sem nota", NUNCA zero. `Number('')`
 * e 0, e seguir esse caminho faria o candidato aparecer para a banca com uma
 * nota que ninguem lhe atribuiu — e com uma media calculada em cima dela. Por
 * isso o vazio vira `undefined` e sai do corpo da requisicao.
 */
const nota = z
  .coerce.number()
  .transform((valor) => (valor === undefined ? 0 : Number(valor)))
  .refine((valor) => valor === undefined || !Number.isNaN(valor), {
    message: 'Informe um número (ex.: 8.5)',
  })
  .refine((valor) => valor === undefined || (valor >= 0 && valor <= 10), {
    message: 'A nota deve estar entre 0 e 10',
  })
  // `maxDecimalPlaces: 2` do backend: 8.5 e 8.55 passam, 8.555 não.
  .refine((valor) => valor === undefined || Math.round(valor * 100) / 100 === valor, {
    message: 'Use no máximo 2 casas decimais',
  });

export const esquemaInscricao = z.object({
  nomeCompleto: z
    .string()
    .trim()
    .max(150, 'O nome deve ter no máximo 150 caracteres')
    // Mesmo requisito do backend: nome e sobrenome, ao menos 3 caracteres.
    .regex(/^(?=.{3,})\S+(\s+\S+)+$/, 'Informe nome e sobrenome'),

  matricula: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9._-]{3,30}$/,
      'Use de 3 a 30 caracteres: letras, números, ponto, hífen ou _',
    ),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Informe o e-mail: é por ele que a confirmação chega')
    .email('Informe um e-mail válido')
    .max(150, 'O e-mail deve ter no máximo 150 caracteres'),

  cursoId: z.string().uuid('Escolha o seu curso'),
  disciplinaId: z.string().uuid('Escolha a disciplina'),
  professorId: z.string().uuid('Escolha o professor responsável'),
  turno: z.nativeEnum(Turno, { errorMap: () => ({ message: 'Escolha o turno' }) }),

  n1: nota,
  n2: nota,
});

export type DadosFormularioInscricao = z.infer<typeof esquemaInscricao>;

export const CAMPOS_INSCRICAO = [
  'nomeCompleto',
  'matricula',
  'email',
  'cursoId',
  'disciplinaId',
  'professorId',
  'turno',
  'n1',
  'n2',
] as const;

/**
 * Valida o anexo ANTES do envio.
 *
 * O backend confere o tipo declarado E a assinatura do arquivo, e recusa o que
 * nao for PDF de verdade. Conferir aqui nao substitui aquilo — evita um upload
 * de ate 5 MB que ja se sabe que vai ser recusado, e diz o motivo na hora.
 */
export function problemaNoBoletim(arquivo: File | null): string | null {
  if (!arquivo) return 'Anexe o PDF do seu boletim';

  if (arquivo.type !== MIME_PDF) {
    return 'O boletim precisa ser um arquivo PDF';
  }

  if (arquivo.size > LIMITE_BOLETIM_BYTES) {
    const mb = (arquivo.size / (1024 * 1024)).toFixed(1);
    return `O arquivo tem ${mb} MB e o limite é de 5 MB`;
  }

  if (arquivo.size === 0) {
    return 'O arquivo está vazio';
  }

  return null;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
