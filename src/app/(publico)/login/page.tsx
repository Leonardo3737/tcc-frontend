import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, CalendarCheck, GraduationCap, Repeat2, Star } from 'lucide-react';

import { Card, CardConteudo } from '@/components/ui/card';
import { SkeletonTexto } from '@/components/ui/skeleton';
import { FormularioLogin } from '@/features/auth/components/formulario-login';
import { rotas } from '@/config/rotas';

export const metadata: Metadata = { title: 'Entrar' };

/**
 * Tela de entrada.
 *
 * Duas colunas a partir de `lg`: a esquerda apresenta a plataforma, a direita
 * autentica. O painel de apresentacao nao e enfeite — e a unica tela que alguem
 * de fora ve, e o lugar onde cabe explicar o conceito que organiza o sistema
 * inteiro: MONITOR e MONITORADO sao papeis por monitoria, nao tipos de conta.
 *
 * Abaixo de `lg` ele some: no celular, quem abre o login quer entrar, e um bloco
 * institucional so empurraria o formulario para baixo da dobra.
 */
export default function PaginaLogin() {
  return (
    <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_minmax(0,26rem)] lg:gap-16">
      {/*
        O formulario vem PRIMEIRO no DOM — o h1 da pagina esta nele. O painel,
        cujo titulo e um h2, e reposicionado para a esquerda com `order`, o que
        mantem a ordem de cabecalhos (h1 -> h2) e a ordem de foco corretas sem
        alterar o que se ve.
      */}
      <div className="mx-auto w-full max-w-md lg:order-2 lg:mx-0">
        <Card className="lg:border-borda-forte">
          <CardConteudo className="space-y-5 sm:p-6">
            <div className="space-y-1.5">
              <h1 className="font-titulo text-titulo-pagina text-texto">Entrar na plataforma</h1>
              <p className="text-sm text-texto-suave">
                Acesse com o seu e-mail institucional para ver suas monitorias e atendimentos.
              </p>
            </div>

            {/*
              Suspense porque o formulario le `searchParams` (destino, expirou)
              com useSearchParams — sem o limite de suspensao, a rota inteira
              seria empurrada para renderizacao dinamica.
            */}
            <Suspense fallback={<SkeletonTexto linhas={5} />}>
              <FormularioLogin />
            </Suspense>
          </CardConteudo>

          <div className="space-y-2.5 border-t border-borda bg-fundo-suave/60 p-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
              Ainda não tem conta?
            </p>

            {/*
              Dois caminhos distintos, apresentados lado a lado. Antes eram duas
              linhas de texto miudo, e o cadastro de docente — que exige codigo
              da instituicao — ficava quase invisivel.
            */}
            <div className="grid gap-2 sm:grid-cols-2">
              <LinkCadastro
                href={rotas.cadastroAluno}
                icone={<GraduationCap className="h-4 w-4" aria-hidden />}
                titulo="Sou aluno"
                descricao="Participe de monitorias"
              />
              <LinkCadastro
                href={rotas.cadastroProfessor}
                icone={<BookOpen className="h-4 w-4" aria-hidden />}
                titulo="Sou professor"
                descricao="Crie e acompanhe ofertas"
              />
            </div>
          </div>
        </Card>
      </div>

      <PainelApresentacao />
    </div>
  );
}

function LinkCadastro({
  href,
  icone,
  titulo,
  descricao,
}: {
  href: string;
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md border border-borda bg-superficie px-3 py-2.5 transition-colors hover:border-primaria/40 hover:bg-primaria-suave/40"
    >
      <span className="text-primaria">{icone}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-texto">{titulo}</span>
        <span className="block text-xs text-texto-suave">{descricao}</span>
      </span>
    </Link>
  );
}

/**
 * Apresentacao da plataforma.
 *
 * `aria-hidden` nao se aplica: e conteudo legivel, e nao decoracao. Mas ele e
 * escondido abaixo de `lg` — no celular o formulario e o que importa.
 */
function PainelApresentacao() {
  return (
    <section aria-labelledby="titulo-apresentacao" className="hidden lg:order-1 lg:block">
      <p className="text-xs font-semibold uppercase tracking-wide text-primaria">
        Monitoria no ensino superior
      </p>

      <h2 id="titulo-apresentacao" className="mt-2.5 max-w-md font-titulo text-[1.75rem] font-semibold leading-[1.2] tracking-tight text-texto xl:text-[2.125rem] xl:leading-[1.15]">
        O apoio acadêmico da sua disciplina, organizado em um só lugar.
      </h2>

      <p className="mt-3 max-w-md text-sm text-texto-suave xl:text-base">
        Professores criam as monitorias e habilitam monitores. Alunos encontram horários reais,
        agendam atendimento e avaliam depois.
      </p>

      {/*
        O conceito central do dominio, dito para quem ainda nao entrou. Ele muda
        a forma de ler a plataforma inteira: a pergunta nao e "sou monitor?",
        e "sou monitor em qual monitoria?".
      */}
      <div className="mt-6 rounded-card border border-primaria/20 bg-primaria-suave/50 p-4 xl:p-5">
        <p className="flex items-center gap-2 font-titulo text-titulo-cartao text-texto">
          <Repeat2 className="h-4 w-4 text-primaria" aria-hidden />O papel é da monitoria, não
          da conta
        </p>

        <p className="mt-2 text-sm text-texto-suave">
          A mesma pessoa pode ser <strong className="font-semibold text-texto">monitora</strong>{' '}
          em Cálculo I e <strong className="font-semibold text-texto">monitorada</strong> em Banco
          de Dados. Cada monitoria tem o seu papel — e o que você pode fazer muda junto.
        </p>
      </div>

      <ul className="mt-6 space-y-3.5">
        <Recurso
          icone={<CalendarCheck className="h-4 w-4" aria-hidden />}
          titulo="Agenda que respeita a disponibilidade"
          descricao="O monitor declara seus horários; o agendamento só acontece dentro deles, sem conflito."
        />
        <Recurso
          icone={<Star className="h-4 w-4" aria-hidden />}
          titulo="Presença e avaliação"
          descricao="A presença é registrada por pessoa, e quem participou avalia o atendimento de forma anônima."
        />
        <Recurso
          icone={<BookOpen className="h-4 w-4" aria-hidden />}
          titulo="Materiais e indicadores"
          descricao="Acervo restrito a quem participa, e números de acompanhamento para o professor responsável."
        />
      </ul>
    </section>
  );
}

function Recurso({
  icone,
  titulo,
  descricao,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-superficie text-primaria ring-1 ring-borda">
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-texto">{titulo}</span>
        <span className="mt-0.5 block text-sm text-texto-suave">{descricao}</span>
      </span>
    </li>
  );
}
