'use client';

import { useQuery } from '@tanstack/react-query';

import { ComboBox } from '@/components/ui/combobox';
import { useListaParaCombo } from '@/hooks/use-lista-para-combo';
import { chaves } from '@/lib/query/chaves';
import type { Disciplina } from '@/types/dominio';
import { detalharDisciplina, listarDisciplinas } from '../api/disciplinas.service';

/**
 * "Todas as disciplinas" + a lista, para recortar uma LISTAGEM.
 *
 * Par do `FiltroDeCurso`, com as mesmas duas diferencas em relacao a um campo
 * de formulario: vazio significa "nao filtrar", nao "falta escolher"; e entram
 * tambem as INATIVAS, porque uma disciplina fora de circulacao continua tendo
 * registros vinculados — e procura-los e justamente quando o filtro serve.
 *
 * `cursoId` encadeia os dois filtros: com um curso escolhido, so aparecem as
 * disciplinas DELE. Oferecer uma disciplina de outro curso ao lado de um
 * filtro de curso produziria sempre lista vazia, sem dizer por que.
 *
 * A busca vai ao SERVIDOR (`GET /disciplinas` aceita `busca`) e as paginas sao
 * carregadas sob demanda: o catalogo cresce sem teto.
 */
export function FiltroDeDisciplina({
  valor,
  aoMudar,
  cursoId,
  className,
  label = 'Disciplina',
}: {
  valor: string;
  aoMudar: (disciplinaId: string) => void;
  /** Restringe as opcoes a um curso. Vazio = todas. */
  cursoId?: string;
  className?: string;
  label?: string;
}) {
  const recorte = cursoId ? { cursoId } : {};

  const lista = useListaParaCombo({
    // O curso entra na chave: trocar de curso é outra lista, não a mesma filtrada.
    chave: chaves.disciplinas.lista(recorte),
    buscar: (parametros) => listarDisciplinas({ ...parametros, ...recorte }),
    paraItem: (disciplina: Disciplina) => ({
      valor: disciplina.id,
      rotulo: disciplina.ativa ? disciplina.nome : `${disciplina.nome} (inativa)`,
      descricao: disciplina.codigo,
    }),
  });

  /**
   * Rotulo do selecionado quando ele nao esta entre os carregados — caso de um
   * filtro restaurado da URL apontando um id que so apareceria em outra pagina.
   */
  const carregado = lista.itens.find((item) => item.valor === valor)?.rotulo;

  const detalhe = useQuery({
    queryKey: chaves.disciplinas.detalhe(valor),
    enabled: Boolean(valor) && !carregado,
    queryFn: () => detalharDisciplina(valor),
    staleTime: 5 * 60_000,
  });

  const rotuloSelecionado = carregado ?? detalhe.data?.nome;

  // Sem disciplinas (ou com a consulta em erro) o filtro não recorta nada: some.
  if (lista.erro || (!lista.carregando && lista.total === 0 && !valor)) return null;

  return (
    <ComboBox
      label={label}
      rotuloOculto
      valor={valor}
      {...(rotuloSelecionado ? { rotuloSelecionado } : {})}
      aoEscolher={aoMudar}
      lista={lista}
      opcaoVazia="Todas as disciplinas"
      placeholderBusca="Buscar disciplina…"
      textoVazio="Nenhuma disciplina encontrada"
      {...(className ? { className } : {})}
    />
  );
}
