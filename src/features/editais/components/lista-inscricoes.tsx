'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Download, FileX2, Trophy, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';

import { CampoBusca } from '@/components/comum/campo-busca';
import { Paginacao } from '@/components/comum/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button, classesBotao } from '@/components/ui/button';
import { Select } from '@/components/ui/campo';
import { Card, CardConteudo } from '@/components/ui/card';
import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonLista } from '@/components/ui/skeleton';
import {
  Tabela,
  TabelaCabecalho,
  TabelaCabecalhoCelula,
  TabelaCelula,
  TabelaCorpo,
  TabelaLinha,
} from '@/components/ui/tabela';
import { FiltroDeCurso } from '@/features/cursos/components/seletor-de-cursos';
import {
  DialogoCadastrarUsuario,
  type ValoresIniciaisAluno,
} from '@/features/usuarios/components/dialogo-cadastrar-usuario';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { formatarDataHora } from '@/lib/datas/fuso';
import { chaves } from '@/lib/query/chaves';
import { cn } from '@/lib/utils';
import { useSessao } from '@/providers/sessao-provider';
import { Turno, type Edital, type InscricaoEdital } from '@/types/dominio';
import {
  listarInscricoes,
  urlDoBoletim,
  type CampoOrdenacaoInscricao,
  type DirecaoOrdenacao,
} from '../api/inscricoes.service';
import type { SituacaoEdital } from '../situacao';

const ROTULO_TURNO: Record<Turno, string> = {
  [Turno.MATUTINO]: 'Matutino',
  [Turno.VESPERTINO]: 'Vespertino',
  [Turno.NOTURNO]: 'Noturno',
};

const CAMPOS_ORDENAVEIS: Array<{ campo: CampoOrdenacaoInscricao; rotulo: string }> = [
  { campo: 'media', rotulo: 'Média' },
  { campo: 'n1', rotulo: 'N1' },
  { campo: 'n2', rotulo: 'N2' },
  { campo: 'nome', rotulo: 'Nome' },
  { campo: 'matricula', rotulo: 'Matrícula' },
  { campo: 'criadoEm', rotulo: 'Inscrição' },
];

/** `numeric` do backend chega como número; ausente é NULO, nunca zero. */
function nota(valor: number | null): string {
  return valor === null ? '—' : valor.toFixed(2).replace('.', ',');
}

/**
 * Candidaturas do edital.
 *
 * Ordenacao, filtros e paginacao sao TODOS do servidor. Carregar tudo para
 * ordenar no navegador quebraria na segunda pagina — o "maior" pode estar na
 * proxima — e e exatamente o que o backend oferece pronto, com NULLS LAST para
 * que "sem nota" nunca seja lido como "nota baixa".
 */
export function ListaInscricoes({
  edital,
  situacao,
}: {
  edital: Edital;
  situacao: SituacaoEdital;
}) {
  const { fuso } = useSessao();
  const { obter, obterNumero, definir, pendente } = useFiltrosUrl();
  const [detalhe, setDetalhe] = useState<InscricaoEdital | null>(null);
  const [cadastrando, setCadastrando] = useState<ValoresIniciaisAluno | null>(null);

  const busca = obter('busca');
  const cursoId = obter('curso');
  const turno = obter('turno');
  const ordenarPor = (obter('ordem', 'media') || 'media') as CampoOrdenacaoInscricao;
  const direcao = (obter('dir', 'desc') || 'desc') as DirecaoOrdenacao;
  const pagina = obterNumero('pagina', 1);

  const filtro = {
    editalId: edital.id,
    busca: busca || undefined,
    cursoId: cursoId || undefined,
    turno: (turno || undefined) as Turno | undefined,
    ordenarPor,
    direcao,
    pagina,
    limite: 20,
  };

  const consulta = useQuery({
    queryKey: chaves.inscricoes.lista(filtro),
    queryFn: () => listarInscricoes(filtro),
  });

  /**
   * MAIOR MEDIA do edital, para o atalho do primeiro colocado.
   *
   * Consulta propria, de uma linha so, ordenada por media desc com NULLS LAST
   * no servidor. Nao se usa a primeira linha da TABELA para isso: ela depende
   * do filtro, da ordenacao escolhida e da pagina — "quem esta no topo da tela"
   * nao e "quem tem a maior media do edital".
   *
   * So roda com o edital ENCERRADO, que e quando o atalho existe.
   */
  const topo = useQuery({
    queryKey: chaves.inscricoes.topo(edital.id),
    enabled: situacao === 'ENCERRADO',
    queryFn: () =>
      listarInscricoes({
        editalId: edital.id,
        ordenarPor: 'media',
        direcao: 'desc',
        limite: 1,
      }),
  });

  /**
   * `null` quando ninguem tem media calculada: nota ausente NAO conta como
   * zero, entao nesse caso nao ha primeiro colocado a apontar.
   */
  const maiorMedia = topo.data?.dados[0]?.media ?? null;

  const ehPrimeiroColocado = (inscricao: InscricaoEdital) =>
    situacao === 'ENCERRADO' &&
    maiorMedia !== null &&
    inscricao.media !== null &&
    // Empate na maior media marca TODOS os empatados, não só um.
    inscricao.media === maiorMedia;

  const temFiltro = Boolean(busca || cursoId || turno);

  const limpar = () =>
    definir({ busca: undefined, curso: undefined, turno: undefined, pagina: undefined });

  /** Trocar filtro ou ordenação reinicia a página: a 3 do recorte anterior raramente existe. */
  const filtrar = (novos: Record<string, string | number | undefined>) =>
    definir({ ...novos, pagina: undefined });

  const alternarOrdem = (campo: CampoOrdenacaoInscricao) => {
    const mesma = ordenarPor === campo;
    filtrar({ ordem: campo, dir: mesma && direcao === 'desc' ? 'asc' : 'desc' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <CampoBusca
          valorInicial={busca}
          aoBuscar={(termo) => filtrar({ busca: termo })}
          placeholder="Buscar por nome, matrícula ou e-mail…"
          rotulo="Buscar candidatos"
          carregando={pendente || consulta.isFetching}
          className="flex-1"
        />

        <FiltroDeCurso
          className="lg:w-48"
          valor={cursoId}
          aoMudar={(novo) => filtrar({ curso: novo })}
        />

        <Select
          label="Turno"
          className="lg:w-40 [&>label]:sr-only"
          value={turno}
          onChange={(evento) => filtrar({ turno: evento.target.value })}
          opcoes={[
            { valor: '', rotulo: 'Todos os turnos' },
            ...Object.values(Turno).map((item) => ({
              valor: item,
              rotulo: ROTULO_TURNO[item],
            })),
          ]}
        />

        {temFiltro && (
          <Button variante="fantasma" tamanho="sm" onClick={limpar}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Ordenação em botões no mobile: os cabeçalhos da tabela não existem lá. */}
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        <span className="text-xs text-texto-suave">Ordenar por</span>
        {CAMPOS_ORDENAVEIS.map(({ campo, rotulo }) => (
          <BotaoOrdem
            key={campo}
            rotulo={rotulo}
            ativo={ordenarPor === campo}
            direcao={direcao}
            aoClicar={() => alternarOrdem(campo)}
          />
        ))}
      </div>

      {consulta.isPending && <SkeletonLista itens={5} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<Users className="h-8 w-8" aria-hidden />}
          titulo={temFiltro ? 'Nenhuma candidatura encontrada' : 'Nenhuma inscrição ainda'}
          descricao={
            temFiltro
              ? 'Nada corresponde aos filtros aplicados.'
              : situacao === 'ABERTO'
                ? 'As inscrições estão abertas. As candidaturas aparecem aqui assim que chegarem.'
                : 'Este edital não recebeu candidaturas.'
          }
          acao={
            temFiltro && (
              <Button variante="secundaria" onClick={limpar}>
                Limpar filtros
              </Button>
            )
          }
        />
      )}

      {consulta.isSuccess && consulta.data.dados.length > 0 && (
        <Card>
          <div className="hidden overflow-x-auto md:block">
            <Tabela>
              <TabelaCabecalho>
                <TabelaLinha>
                  <ColunaOrdenavel
                    rotulo="Candidato"
                    campo="nome"
                    atual={ordenarPor}
                    direcao={direcao}
                    aoOrdenar={alternarOrdem}
                  />
                  <TabelaCabecalhoCelula>Curso · Disciplina</TabelaCabecalhoCelula>
                  <TabelaCabecalhoCelula>Turno</TabelaCabecalhoCelula>
                  <ColunaOrdenavel
                    rotulo="N1"
                    campo="n1"
                    atual={ordenarPor}
                    direcao={direcao}
                    aoOrdenar={alternarOrdem}
                  />
                  <ColunaOrdenavel
                    rotulo="N2"
                    campo="n2"
                    atual={ordenarPor}
                    direcao={direcao}
                    aoOrdenar={alternarOrdem}
                  />
                  <ColunaOrdenavel
                    rotulo="Média"
                    campo="media"
                    atual={ordenarPor}
                    direcao={direcao}
                    aoOrdenar={alternarOrdem}
                  />
                  <TabelaCabecalhoCelula className="text-right">Ações</TabelaCabecalhoCelula>
                </TabelaLinha>
              </TabelaCabecalho>

              <TabelaCorpo>
                {consulta.data.dados.map((inscricao) => (
                  <TabelaLinha
                    key={inscricao.id}
                    className={cn(ehPrimeiroColocado(inscricao) && 'bg-sucesso-suave/40')}
                  >
                    <TabelaCelula>
                      <span className="flex items-center gap-2">
                        {ehPrimeiroColocado(inscricao) && (
                          <Trophy
                            className="h-4 w-4 shrink-0 text-acento-forte"
                            aria-label="Maior média do edital"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-texto">
                            {inscricao.nomeCompleto}
                          </span>
                          <span className="block truncate text-xs text-texto-suave">
                            {inscricao.matricula} · {inscricao.email}
                          </span>
                        </span>
                      </span>
                    </TabelaCelula>

                    <TabelaCelula>
                      <span className="block text-sm text-texto">{inscricao.disciplina.nome}</span>
                      <span className="block text-xs text-texto-suave">
                        {inscricao.curso.nome}
                      </span>
                    </TabelaCelula>

                    <TabelaCelula className="text-sm">
                      {ROTULO_TURNO[inscricao.turno]}
                    </TabelaCelula>
                    <TabelaCelula className="tabular-nums">{nota(inscricao.n1)}</TabelaCelula>
                    <TabelaCelula className="tabular-nums">{nota(inscricao.n2)}</TabelaCelula>
                    <TabelaCelula className="font-semibold tabular-nums">
                      {nota(inscricao.media)}
                    </TabelaCelula>

                    <TabelaCelula className="text-right">
                      <Button
                        variante="fantasma"
                        tamanho="sm"
                        onClick={() => setDetalhe(inscricao)}
                      >
                        Detalhes
                      </Button>
                    </TabelaCelula>
                  </TabelaLinha>
                ))}
              </TabelaCorpo>
            </Tabela>
          </div>

          {/* Cartões no mobile: 7 colunas não cabem em 375px. */}
          <div className="divide-y divide-borda md:hidden">
            {consulta.data.dados.map((inscricao) => (
              <div key={inscricao.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium text-texto">
                      {ehPrimeiroColocado(inscricao) && (
                        <Trophy
                          className="h-3.5 w-3.5 shrink-0 text-acento-forte"
                          aria-label="Maior média do edital"
                        />
                      )}
                      <span className="truncate">{inscricao.nomeCompleto}</span>
                    </p>
                    <p className="truncate text-xs text-texto-suave">{inscricao.matricula}</p>
                  </div>

                  <Badge tom="neutro">{nota(inscricao.media)}</Badge>
                </div>

                <p className="text-xs text-texto-suave">
                  {inscricao.disciplina.nome} · {ROTULO_TURNO[inscricao.turno]}
                </p>

                <Button
                  variante="secundaria"
                  tamanho="sm"
                  className="w-full"
                  onClick={() => setDetalhe(inscricao)}
                >
                  Detalhes
                </Button>
              </div>
            ))}
          </div>

          <CardConteudo className="pt-0">
            <Paginacao
              meta={consulta.data.meta}
              aoMudarPagina={(nova) => definir({ pagina: nova })}
              desabilitado={consulta.isFetching}
            />
          </CardConteudo>
        </Card>
      )}

      <DialogoInscricao
        inscricao={detalhe}
        fuso={fuso}
        primeiroColocado={detalhe ? ehPrimeiroColocado(detalhe) : false}
        aoFechar={() => setDetalhe(null)}
        aoCadastrar={(valores) => {
          setDetalhe(null);
          setCadastrando(valores);
        }}
      />

      {/*
        O fluxo de cadastro é o MESMO de Pessoas — apenas pré-preenchido. A
        conta só nasce quando o professor confirma; nada é criado por ter a
        maior média.
      */}
      <DialogoCadastrarUsuario
        tipo="aluno"
        aberto={cadastrando !== null}
        aoFechar={() => setCadastrando(null)}
        {...(cadastrando ? { valoresIniciais: cadastrando } : {})}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ColunaOrdenavel({
  rotulo,
  campo,
  atual,
  direcao,
  aoOrdenar,
}: {
  rotulo: string;
  campo: CampoOrdenacaoInscricao;
  atual: CampoOrdenacaoInscricao;
  direcao: DirecaoOrdenacao;
  aoOrdenar: (campo: CampoOrdenacaoInscricao) => void;
}) {
  const ativo = atual === campo;

  return (
    <TabelaCabecalhoCelula
      // `aria-sort` é o que anuncia a ordenação ativa a leitores de tela; o
      // ícone sozinho só comunica a quem enxerga.
      aria-sort={ativo ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => aoOrdenar(campo)}
        className={cn(
          'inline-flex items-center gap-1 rounded transition-colors hover:text-texto',
          ativo && 'font-semibold text-texto',
        )}
      >
        {rotulo}
        {ativo &&
          (direcao === 'asc' ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          ))}
      </button>
    </TabelaCabecalhoCelula>
  );
}

function BotaoOrdem({
  rotulo,
  ativo,
  direcao,
  aoClicar,
}: {
  rotulo: string;
  ativo: boolean;
  direcao: DirecaoOrdenacao;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
        ativo
          ? 'border-primaria bg-primaria-suave font-semibold text-primaria'
          : 'border-borda-forte text-texto-suave',
      )}
    >
      {rotulo}
      {ativo &&
        (direcao === 'asc' ? (
          <ArrowUp className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden />
        ))}
    </button>
  );
}

/**
 * Detalhe da candidatura, com o boletim e o atalho de cadastro.
 *
 * O PDF e baixado pela rota PROTEGIDA (`/inscricoes/:id/boletim`), atraves do
 * proxy: o cookie httpOnly acompanha e o backend confere o perfil. Nao existe
 * URL publica para o documento, e esta tela nao cria uma.
 */
function DialogoInscricao({
  inscricao,
  fuso,
  primeiroColocado,
  aoFechar,
  aoCadastrar,
}: {
  inscricao: InscricaoEdital | null;
  fuso: string;
  primeiroColocado: boolean;
  aoFechar: () => void;
  aoCadastrar: (valores: ValoresIniciaisAluno) => void;
}) {
  if (!inscricao) return null;

  const jaTemConta = inscricao.alunoCadastrado !== null;

  return (
    <Dialog open onOpenChange={(estado) => !estado && aoFechar()}>
      <DialogConteudo titulo={inscricao.nomeCompleto} descricao={inscricao.email}>
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Dado rotulo="Matrícula" valor={inscricao.matricula} />
            <Dado rotulo="Turno" valor={ROTULO_TURNO[inscricao.turno]} />
            <Dado rotulo="Curso" valor={inscricao.curso.nome} />
            <Dado rotulo="Disciplina" valor={inscricao.disciplina.nome} />
            <Dado rotulo="Professor responsável" valor={inscricao.professor.nome ?? '—'} />
            <Dado rotulo="Inscrição" valor={formatarDataHora(inscricao.criadoEm, fuso)} />
            <Dado rotulo="N1" valor={nota(inscricao.n1)} />
            <Dado rotulo="N2" valor={nota(inscricao.n2)} />
            <Dado rotulo="Média final" valor={nota(inscricao.media)} />
          </dl>

          {inscricao.boletim ? (
            <a
              href={urlDoBoletim(inscricao.id)}
              className={classesBotao('secundaria', 'md', 'w-full')}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Baixar boletim ({inscricao.boletim.nomeOriginal})
            </a>
          ) : (
            <p className="flex items-center gap-2 rounded-md bg-fundo-suave px-3 py-2 text-sm text-texto-suave">
              <FileX2 className="h-4 w-4 shrink-0" aria-hidden />
              Esta candidatura não tem boletim anexado.
            </p>
          )}

          {/*
            O atalho só existe com o edital encerrado e para quem tem a maior
            média. Se a matrícula já pertence a um aluno cadastrado, oferecer
            "cadastrar" produziria duplicidade — e o backend sabe disso
            (`alunoCadastrado`), então a tela diz em vez de oferecer.
          */}
          {primeiroColocado &&
            (jaTemConta ? (
              <p className="rounded-md border border-borda bg-fundo-suave px-3 py-2 text-sm text-texto-suave">
                Maior média do edital. Esta matrícula <strong>já tem conta</strong> na
                plataforma — não é preciso cadastrar.
              </p>
            ) : (
              <Button
                className="w-full"
                onClick={() =>
                  aoCadastrar({
                    nome: inscricao.nomeCompleto,
                    email: inscricao.email,
                    matricula: inscricao.matricula,
                    cursoId: inscricao.curso.id,
                  })
                }
                iconeEsquerda={<UserPlus className="h-4 w-4" aria-hidden />}
              >
                Cadastrar como aluno
              </Button>
            ))}
        </div>
      </DialogConteudo>
    </Dialog>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd className="font-medium text-texto">{valor}</dd>
    </div>
  );
}
