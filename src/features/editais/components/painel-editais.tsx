'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Pencil, Plus, ScrollText } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, classesBotao } from '@/components/ui/button';
import { Select } from '@/components/ui/campo';
import { Card, CardConteudo } from '@/components/ui/card';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonCard, SkeletonLista } from '@/components/ui/skeleton';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { chaves } from '@/lib/query/chaves';
import { useSessao } from '@/providers/sessao-provider';
import type { Edital } from '@/types/dominio';
import { listarEditais } from '../api/editais.service';
import {
  ROTULO_SITUACAO,
  TOM_SITUACAO,
  formatarDataDeCalendario,
  hojeNaInstituicao,
  situacaoDoEdital,
} from '../situacao';
import { DialogoEdital } from './dialogo-edital';
import { ListaInscricoes } from './lista-inscricoes';

/**
 * Quantos editais trazer para escolher o exibido.
 *
 * Uma pagina basta: ordenados por `inicioInscricoes` DESC, o aberto e os mais
 * recentes estao sempre no topo — um edital aberto ja comecou, entao so os
 * futuros ficam acima dele. Cinquenta editais futuros simultaneos nao e um
 * cenario real.
 */
const LIMITE = 50;

/**
 * Editais e candidaturas.
 *
 * UMA consulta alimenta tudo: a selecao automatica, o seletor de edital e a
 * condicao de criar. Separar em "buscar o aberto" e "buscar o mais recente"
 * custaria duas requisicoes para responder o que uma lista ordenada ja diz.
 */
export function PainelEditais() {
  const { fuso } = useSessao();
  const { obter, definir } = useFiltrosUrl();
  const [emEdicao, setEmEdicao] = useState<Edital | null>(null);
  const [criando, setCriando] = useState(false);

  const filtro = { direcao: 'desc' as const, limite: LIMITE };

  const consulta = useQuery({
    queryKey: chaves.editais.lista(filtro),
    queryFn: () => listarEditais(filtro),
  });

  const editais = consulta.data?.dados ?? [];
  const hoje = hojeNaInstituicao(fuso);

  /**
   * Selecao automatica, na ordem que o escopo define:
   *   1. o edital ABERTO, se existir;
   *   2. senao, o mais RECENTE.
   *
   * As duas saem da mesma lista: `aceitandoInscricoes` e derivado pelo servidor
   * (nao recalculado aqui), e "mais recente" e o primeiro item da ordenacao
   * `inicioInscricoes` DESC que a API oferece. Havendo mais de um aberto, vale
   * o primeiro nessa mesma ordem — nenhuma regra de prioridade foi inventada.
   *
   * A escolha explicita do usuario (`?edital=`) tem precedencia sobre as duas.
   */
  const escolhido = obter('edital');
  const abertos = editais.filter((edital) => edital.aceitandoInscricoes);

  const selecionado =
    editais.find((edital) => edital.id === escolhido) ?? abertos[0] ?? editais[0] ?? null;

  /**
   * Criar so quando NAO ha edital aberto. A condicao vem dos dados, entao ela
   * se atualiza sozinha quando a lista e invalidada — depois de criar, editar
   * ou de o prazo virar.
   */
  const podeCriar = abertos.length === 0;

  if (consulta.isPending) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonLista itens={4} />
      </div>
    );
  }

  if (consulta.isError) {
    return <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />;
  }

  if (!selecionado) {
    return (
      <>
        <EstadoVazio
          icone={<ScrollText className="h-8 w-8" aria-hidden />}
          titulo="Nenhum edital cadastrado"
          descricao="Crie o primeiro edital para abrir inscrições de monitoria. Os candidatos se inscrevem por uma página pública, sem precisar de conta."
          acao={
            <Button
              onClick={() => setCriando(true)}
              iconeEsquerda={<Plus className="h-4 w-4" aria-hidden />}
            >
              Criar primeiro edital
            </Button>
          }
        />

        <DialogoEdital
          aberto={criando}
          aoFechar={() => setCriando(false)}
          aoSalvar={(novo) => definir({ edital: novo.id })}
        />
      </>
    );
  }

  const situacao = situacaoDoEdital(selecionado, hoje);

  return (
    <div className="space-y-5">
      <CabecalhoEdital
        edital={selecionado}
        editais={editais}
        situacao={situacao}
        podeCriar={podeCriar}
        aoTrocar={(id) => definir({ edital: id, pagina: undefined })}
        aoEditar={() => setEmEdicao(selecionado)}
        aoCriar={() => setCriando(true)}
      />

      <ListaInscricoes edital={selecionado} situacao={situacao} />

      {/*
        Salvar FIXA o edital editado em `?edital=`.

        Sem isso a tela pode pular para outro: a seleção automática recalcula a
        partir dos dados novos, e uma edição que fecha o período faz o "aberto"
        passar a ser outro edital. O professor acabaria olhando para um registro
        diferente do que acabou de alterar, sem ter pedido nada disso.
      */}
      <DialogoEdital
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        aoSalvar={(salvo) => definir({ edital: salvo.id, pagina: undefined })}
        {...(emEdicao ? { edital: emEdicao } : {})}
      />

      <DialogoEdital
        aberto={criando}
        aoFechar={() => setCriando(false)}
        // Seleciona o recém-criado, com o id que o SERVIDOR devolveu.
        aoSalvar={(novo) => definir({ edital: novo.id, pagina: undefined })}
      />
    </div>
  );
}

function CabecalhoEdital({
  edital,
  editais,
  situacao,
  podeCriar,
  aoTrocar,
  aoEditar,
  aoCriar,
}: {
  edital: Edital;
  editais: Edital[];
  situacao: ReturnType<typeof situacaoDoEdital>;
  podeCriar: boolean;
  aoTrocar: (id: string) => void;
  aoEditar: () => void;
  aoCriar: () => void;
}) {
  return (
    <Card>
      <CardConteudo className="space-y-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-titulo text-titulo-cartao text-texto">
                Edital {edital.ano}/{edital.semestre}
              </h2>
              <Badge tom={TOM_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Badge>
            </div>

            <p className="text-sm text-texto-suave">
              Inscrições de {formatarDataDeCalendario(edital.inicioInscricoes)} a{' '}
              {formatarDataDeCalendario(edital.fimInscricoes)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={edital.link}
              target="_blank"
              rel="noopener noreferrer"
              className={classesBotao('secundaria', 'sm')}
            >
              <FileText className="mr-2 h-4 w-4" aria-hidden />
              Edital oficial
              <ExternalLink className="ml-1.5 h-3 w-3" aria-hidden />
            </a>

            <Button
              variante="secundaria"
              tamanho="sm"
              onClick={aoEditar}
              iconeEsquerda={<Pencil className="h-3.5 w-3.5" aria-hidden />}
            >
              Editar
            </Button>

            {/*
              A ação de criar some quando há edital aberto — não fica
              desabilitada sem explicação. O texto abaixo diz o motivo.
            */}
            {podeCriar && (
              <Button
                tamanho="sm"
                onClick={aoCriar}
                iconeEsquerda={<Plus className="h-3.5 w-3.5" aria-hidden />}
              >
                Novo edital
              </Button>
            )}
          </div>
        </div>

        {!podeCriar && (
          <p className="text-xs text-texto-suave">
            Um novo edital só pode ser criado quando não houver nenhum com inscrições abertas.
          </p>
        )}

        {situacao === 'EXCLUIDO' && (
          <Alert tom="alerta" titulo="Edital excluído">
            Ele não aparece na página pública e não aceita inscrições. As candidaturas já
            recebidas foram preservadas. Para reativá-lo, edite e marque como ativo.
          </Alert>
        )}

        {/* Só aparece quando há de fato o que escolher. */}
        {editais.length > 1 && (
          <Select
            label="Edital exibido"
            className="sm:max-w-sm"
            value={edital.id}
            onChange={(evento) => aoTrocar(evento.target.value)}
            opcoes={editais.map((item) => ({
              valor: item.id,
              rotulo: `${item.ano}/${item.semestre} — ${formatarDataDeCalendario(item.inicioInscricoes)} a ${formatarDataDeCalendario(item.fimInscricoes)}${item.ativo ? '' : ' (excluído)'}`,
            }))}
          />
        )}
      </CardConteudo>
    </Card>
  );
}
