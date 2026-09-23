/**
 * Cor estavel por disciplina.
 *
 * A pessoa localiza "Calculo I" pela cor sem ler o nome — mas so se a cor for a
 * MESMA em toda tela e em toda sessao. Por isso ela e derivada do `codigo` (que
 * nao muda) e nao do id, da posicao na lista ou de estado salvo no navegador.
 *
 * O codigo e normalizado antes do hash: "mat101 " e "MAT101" sao a mesma
 * disciplina para quem le, e devem ter a mesma cor.
 *
 * Colisoes sao esperadas (8 cores para N disciplinas): a cor ajuda a achar, mas
 * a identificacao continua sendo o rotulo ao lado. Cor nunca e a unica portadora
 * de informacao.
 */

export const TOTAL_CORES_DISCIPLINA = 8;

/** FNV-1a de 32 bits: curto, sem dependencia e bem distribuido para strings curtas. */
function hashFnv1a(texto: string): number {
  let hash = 0x811c9dc5;

  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice);
    // Multiplicacao por 16777619 (primo FNV) mantendo 32 bits sem sinal.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

export function indiceCorDisciplina(codigo: string | null | undefined): number {
  const normalizado = (codigo ?? '').trim().toUpperCase();
  if (!normalizado) return 0;

  return hashFnv1a(normalizado) % TOTAL_CORES_DISCIPLINA;
}

/**
 * Classes por indice, escritas por extenso: o Tailwind so gera o que encontra
 * literalmente no codigo, entao `bg-disciplina-${n}` montado em tempo de
 * execucao nao existiria no CSS.
 */
const CLASSES = [
  {
    solido: 'bg-disciplina-0',
    faixa: 'before:bg-disciplina-0',
    texto: 'text-disciplina-0',
    suave: 'bg-disciplina-0/10',
  },
  {
    solido: 'bg-disciplina-1',
    faixa: 'before:bg-disciplina-1',
    texto: 'text-disciplina-1',
    suave: 'bg-disciplina-1/10',
  },
  {
    solido: 'bg-disciplina-2',
    faixa: 'before:bg-disciplina-2',
    texto: 'text-disciplina-2',
    suave: 'bg-disciplina-2/10',
  },
  {
    solido: 'bg-disciplina-3',
    faixa: 'before:bg-disciplina-3',
    texto: 'text-disciplina-3',
    suave: 'bg-disciplina-3/10',
  },
  {
    solido: 'bg-disciplina-4',
    faixa: 'before:bg-disciplina-4',
    texto: 'text-disciplina-4',
    suave: 'bg-disciplina-4/10',
  },
  {
    solido: 'bg-disciplina-5',
    faixa: 'before:bg-disciplina-5',
    texto: 'text-disciplina-5',
    suave: 'bg-disciplina-5/10',
  },
  {
    solido: 'bg-disciplina-6',
    faixa: 'before:bg-disciplina-6',
    texto: 'text-disciplina-6',
    suave: 'bg-disciplina-6/10',
  },
  {
    solido: 'bg-disciplina-7',
    faixa: 'before:bg-disciplina-7',
    texto: 'text-disciplina-7',
    suave: 'bg-disciplina-7/10',
  },
] as const;

export type ClassesCorDisciplina = (typeof CLASSES)[number];

export function classesCorDisciplina(codigo: string | null | undefined): ClassesCorDisciplina {
  return CLASSES[indiceCorDisciplina(codigo)] ?? CLASSES[0];
}

/**
 * Sigla curta para o selo da disciplina: iniciais das palavras significativas
 * do nome ("Calculo Diferencial I" -> "CDI"), com o codigo como reserva.
 * Algarismos romanos e numeros entram porque distinguem "Calculo I" de "II".
 */
const PALAVRAS_IGNORADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'para']);

export function siglaDisciplina(nome: string | null | undefined, codigo?: string | null): string {
  const palavras = (nome ?? '')
    .trim()
    .split(/\s+/)
    .filter((palavra) => palavra && !PALAVRAS_IGNORADAS.has(palavra.toLowerCase()));

  if (palavras.length === 0) return (codigo ?? '?').slice(0, 3).toUpperCase();

  if (palavras.length === 1) return palavras[0]!.slice(0, 2).toUpperCase();

  return palavras
    .slice(0, 3)
    .map((palavra) => (/^[IVX]+$|^\d+$/.test(palavra) ? palavra : palavra[0]))
    .join('')
    .slice(0, 3)
    .toUpperCase();
}
