import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { classesBotao } from '@/components/ui/button';
import { Card, CardConteudo } from '@/components/ui/card';
import { rotas } from '@/config/rotas';
import { buscarEditaisAbertos } from '@/features/editais/api/editais.servidor';
import { FormularioInscricao } from '@/features/editais/components/formulario-inscricao';

export const metadata: Metadata = {
  title: 'Inscrição em edital de monitoria',
  description: 'Candidate-se a monitor. Não é preciso ter conta na plataforma.',
};

/**
 * Inscricao em edital. PUBLICA — a unica escrita anonima do sistema.
 *
 * Nao exige conta por uma razao de dominio, nao de conveniencia: a conta do
 * monitor e criada pelo professor DEPOIS da aprovacao, entao exigir login aqui
 * seria exigir o resultado antes do processo.
 *
 * A lista de editais abertos e resolvida no SERVIDOR: assim a pagina ja chega
 * sabendo se ha inscricao aberta, em vez de montar o formulario e descobrir
 * depois que nao havia para quem se inscrever.
 *
 * Quem decide o que esta "aberto" e o backend (`GET /editais/abertos`, avaliado
 * no fuso da instituicao). O cliente nao reconfere datas.
 */
export default async function PaginaInscricao({
  searchParams,
}: {
  searchParams: Promise<{ edital?: string }>;
}) {
  const [abertos, { edital: editalPedido }] = await Promise.all([
    buscarEditaisAbertos(),
    searchParams,
  ]);

  if (abertos.length === 0) {
    return <SemEditalAberto />;
  }

  /**
   * O link do destaque traz `?edital=`. Se ele apontar para um edital que nao
   * esta mais aberto (prazo virou entre o clique e o carregamento), a lista
   * simplesmente nao o contem e o formulario cai no primeiro aberto — nunca em
   * um edital que a API recusaria.
   */
  const ordenados = editalPedido
    ? [...abertos].sort((a, b) =>
        a.id === editalPedido ? -1 : b.id === editalPedido ? 1 : 0,
      )
    : abertos;

  return <FormularioInscricao editais={ordenados} />;
}

/**
 * Sem edital aberto nao ha o que enviar — e o formulario nao aparece.
 *
 * Mostra-lo e recusar no envio produziria um candidato que preenche tudo,
 * anexa o boletim e so entao descobre que o prazo acabou.
 */
function SemEditalAberto() {
  return (
    <Card className="w-full max-w-xl">
      <CardConteudo className="space-y-4 py-8">
        <div className="space-y-1 text-center">
          <h1 className="font-titulo text-titulo-cartao text-texto">
            Nenhuma inscrição aberta no momento
          </h1>
          <p className="text-sm text-texto-suave">
            Não há edital de monitoria recebendo candidaturas agora.
          </p>
        </div>

        <Alert tom="info">
          Os editais são divulgados pela coordenação. Quando um novo período abrir, o aviso
          aparece aqui e na tela de entrada da plataforma.
        </Alert>

        <div className="flex justify-center">
          <Link href={rotas.login} className={classesBotao('secundaria')}>
            Voltar ao login
          </Link>
        </div>
      </CardConteudo>
    </Card>
  );
}
