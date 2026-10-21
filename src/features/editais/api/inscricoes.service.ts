import { apiCliente } from '@/lib/api/cliente';
import type { RespostaPaginada } from '@/types/api';
import type {
  AprovacaoDeInscricao,
  InscricaoConfirmacao,
  InscricaoEdital,
  ResumoPorDisciplina,
  Turno,
} from '@/types/dominio';

/**
 * Candidaturas em edital.
 *
 * Duas faces, e a separacao e do backend: a ESCRITA e publica
 * (`POST /editais/:id/inscricoes`, a unica escrita anonima do sistema) e toda a
 * LEITURA e restrita a PROFESSOR — a listagem carrega nome, matricula e e-mail
 * de pessoas que podem nem ter conta.
 */

export type CampoOrdenacaoInscricao = 'media' | 'n1' | 'n2' | 'nome' | 'matricula' | 'criadoEm';
export type DirecaoOrdenacao = 'asc' | 'desc';

export interface FiltroInscricoes {
  editalId?: string;
  cursoId?: string;
  disciplinaId?: string;
  turno?: Turno;
  professorId?: string;
  /** Parcial em nome, matricula e e-mail, em um campo so. */
  busca?: string;
  /** Ano e semestre do EDITAL, nao da inscricao. */
  ano?: number;
  semestre?: number;
  /**
   * Padrao `media`, que e a ordem em que uma banca le a lista.
   *
   * Notas ausentes vao sempre para o FIM nas duas direcoes (NULLS LAST do
   * backend): ordenar por media nao pode fazer "sem nota" parecer "nota baixa".
   */
  ordenarPor?: CampoOrdenacaoInscricao;
  direcao?: DirecaoOrdenacao;
  pagina?: number;
  limite?: number;
}

export function listarInscricoes(
  filtro: FiltroInscricoes = {},
): Promise<RespostaPaginada<InscricaoEdital>> {
  return apiCliente.get<RespostaPaginada<InscricaoEdital>>('/inscricoes', {
    query: { ...filtro },
  });
}

/** Os mesmos recortes da listagem, sem o que so faz sentido numa lista paginada. */
export type FiltroResumoInscricoes = Omit<
  FiltroInscricoes,
  'pagina' | 'limite' | 'ordenarPor' | 'direcao'
>;

/**
 * Totais por disciplina, para a faixa de cartoes.
 *
 * Recebe os MESMOS filtros da listagem, e isso nao e opcional: sem repassar a
 * busca, o curso e o turno ativos, o numero do cartao deixaria de bater com o
 * conteudo da lista logo abaixo dele.
 *
 * NAO e paginado — o resultado e limitado pelo catalogo de disciplinas, nao
 * pelo numero de candidatos. Por isso reordenar no cliente aqui e correto, ao
 * contrario da listagem.
 */
export function resumoPorDisciplina(
  filtro: FiltroResumoInscricoes = {},
): Promise<ResumoPorDisciplina[]> {
  return apiCliente.get<ResumoPorDisciplina[]>('/inscricoes/resumo', { query: { ...filtro } });
}

/** Inclui `alunoCadastrado`: de quem o professor NAO precisa criar conta. */
export function detalharInscricao(id: string): Promise<InscricaoEdital> {
  return apiCliente.get<InscricaoEdital>(`/inscricoes/${id}`);
}

/**
 * Aprova a candidatura: cria a monitoria e habilita o monitor.
 *
 * SEM CORPO — disciplina, curso, periodo e os dados da conta saem todos da
 * inscricao. Nao ha nada para o professor redigitar, e redigitar permitiria a
 * monitoria nascer divergente da candidatura que a originou.
 *
 * O responsavel pela monitoria e o professor AUTENTICADO, nao o que o
 * candidato indicou: a RN01 exige que quem habilita seja o responsavel. A
 * indicacao segue gravada na inscricao.
 *
 * NAO E ATOMICA, por decisao do backend, e isso muda o tratamento de erro
 * aqui: os estados parciais possiveis (conta sem monitoria; monitoria sem
 * monitor) se resolvem chamando de novo. Por isso a tela oferece tentar
 * novamente em vez de tratar a falha como definitiva.
 *
 * Erros de dominio possiveis: 409 (ja e monitor — RN09; curso nao oferece a
 * disciplina; monitoria da oferta existente fora deste edital), 400 (e-mail
 * fora do dominio institucional exigido para criar conta) e 503 (a senha da
 * conta nova nao pode ser entregue — nada foi criado).
 */
export function aprovarInscricao(id: string): Promise<AprovacaoDeInscricao> {
  return apiCliente.post<AprovacaoDeInscricao>(`/inscricoes/${id}/aprovar`);
}

export interface DadosInscricao {
  nomeCompleto: string;
  matricula: string;
  email: string;
  cursoId: string;
  disciplinaId: string;
  professorId: string;
  turno: Turno;
  /** Em branco = SEM NOTA. Nunca mande 0 para representar ausencia. */
  n1?: number;
  n2?: number;
  boletim: File;
}

/**
 * Inscricao do candidato. PUBLICA — nao exige conta nem token.
 *
 * Vai como `multipart/form-data` por causa do PDF. Duas regras do contrato que
 * nao podem ser contornadas aqui:
 *
 *  - `media` NAO e enviada. Ela e calculada pelo banco a partir de n1 e n2
 *    (coluna GENERATED), e manda-la devolve 400. O frontend nunca apresenta uma
 *    media propria como se fosse oficial;
 *  - nota em branco e OMITIDA, nao enviada como '' nem como 0. O backend trata
 *    string vazia como ausente, mas omitir deixa a intencao explicita — e `0`
 *    seria uma nota que ninguem atribuiu.
 */
export function inscreverEmEdital(
  editalId: string,
  dados: DadosInscricao,
): Promise<InscricaoConfirmacao> {
  const formulario = new FormData();

  formulario.append('nomeCompleto', dados.nomeCompleto);
  formulario.append('matricula', dados.matricula);
  formulario.append('email', dados.email);
  formulario.append('cursoId', dados.cursoId);
  formulario.append('disciplinaId', dados.disciplinaId);
  formulario.append('professorId', dados.professorId);
  formulario.append('turno', dados.turno);

  if (dados.n1 !== undefined) formulario.append('n1', String(dados.n1));
  if (dados.n2 !== undefined) formulario.append('n2', String(dados.n2));

  formulario.append('boletim', dados.boletim);

  return apiCliente.post<InscricaoConfirmacao>(
    `/editais/${editalId}/inscricoes`,
    formulario,
    // Upload de ate 5 MB: o timeout padrao de 15 s derrubaria conexao lenta.
    { timeoutMs: 60_000 },
  );
}

/**
 * URL do download do boletim.
 *
 * Passa pelo proxy autenticado, como todo o resto: o cookie httpOnly acompanha
 * a navegacao de mesma origem e o backend confere o perfil PROFESSOR. NAO e
 * link publico — nao existe forma de obter o PDF sem autorizacao, e esta
 * funcao nao cria uma.
 */
export function urlDoBoletim(inscricaoId: string): string {
  return `/api/backend/inscricoes/${inscricaoId}/boletim`;
}
