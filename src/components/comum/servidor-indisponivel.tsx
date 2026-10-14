'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimboloMarca } from '@/components/layout/marca';
import { servidorDisponivel } from '@/features/configuracao/api/disponibilidade.service';
import { cn } from '@/lib/utils';

/** Tempo maximo ate recarregar sozinha. */
export const SEGUNDOS_ATE_RECARREGAR = 60;
/** Intervalo entre as perguntas "ja voltou?". */
const INTERVALO_VERIFICACAO_MS = 10_000;
/** A partir de quantas recargas seguidas o texto admite que pode ser outra coisa. */
const TENTATIVAS_ATE_AVISO = 3;
const CHAVE_TENTATIVAS = 'monitoria:tentativas-servidor';
const JANELA_TENTATIVAS_MS = 5 * 60_000;

/**
 * Tela de "o servidor esta sendo ligado".
 *
 * A API fica numa hospedagem que desliga o servidor quando ninguem usa o
 * sistema por um tempo; o primeiro acesso seguinte o religa, em cerca de um
 * minuto. Para quem usa, isso parecia o sistema quebrado ("Application error").
 * Esta tela diz o que esta acontecendo em linguagem simples, garante que nada
 * foi perdido e resolve sozinha:
 *
 *  - pergunta a cada 10 s se a API ja responde e recarrega assim que sim;
 *  - de qualquer forma, recarrega ao fim de 1 minuto;
 *  - "Recarregar agora" para quem nao quer esperar.
 *
 * Se a espera se repetir varias vezes seguidas, o texto passa a admitir que o
 * problema pode ser outro — insistir em "so mais um minuto" para sempre seria
 * desonesto.
 */
export function TelaServidorIndisponivel({
  variante = 'pagina',
}: {
  /** `pagina`: ocupa a tela toda. `embutida`: dentro do shell autenticado. */
  variante?: 'pagina' | 'embutida';
}) {
  const [restante, setRestante] = useState(SEGUNDOS_ATE_RECARREGAR);
  const [voltou, setVoltou] = useState(false);
  const [tentativas, setTentativas] = useState(1);
  const recarregando = useRef(false);

  const recarregar = useCallback(() => {
    if (recarregando.current) return;
    recarregando.current = true;
    window.location.reload();
  }, []);

  /**
   * Conta quantas vezes SEGUIDAS a pessoa caiu aqui (so nesta aba). "Seguidas"
   * = a anterior foi ha menos de 5 minutos; senao recomeca do 1, para uma pausa
   * de hoje nao herdar as tentativas de outro dia.
   */
  useEffect(() => {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(CHAVE_TENTATIVAS) ?? 'null') as {
        n?: number;
        em?: number;
      } | null;
      const recente = salvo?.em !== undefined && Date.now() - salvo.em < JANELA_TENTATIVAS_MS;
      const atual = recente && typeof salvo?.n === 'number' ? salvo.n + 1 : 1;
      sessionStorage.setItem(CHAVE_TENTATIVAS, JSON.stringify({ n: atual, em: Date.now() }));
      setTentativas(atual);
    } catch {
      // Sem sessionStorage (modo privado, bloqueio) ou valor corrompido: primeira vez.
    }
  }, []);

  /**
   * Contagem regressiva ate a recarga automatica.
   *
   * Um relogio so, e o tempo restante e CALCULADO a partir do instante de
   * inicio — nao decrementado a cada tique. Em aba de fundo o navegador espaca
   * os timers; com decremento, "1 minuto" viraria varios. Assim, ao voltar para
   * a aba, a conta ja esta certa.
   */
  useEffect(() => {
    if (voltou) return;
    const inicio = Date.now();

    const intervalo = setInterval(() => {
      const decorridos = Math.floor((Date.now() - inicio) / 1000);
      const faltam = Math.max(SEGUNDOS_ATE_RECARREGAR - decorridos, 0);
      setRestante(faltam);
      if (faltam === 0) recarregar();
    }, 1000);

    return () => clearInterval(intervalo);
  }, [voltou, recarregar]);

  // "Ja voltou?" — recarrega antes do fim do minuto se a API responder.
  useEffect(() => {
    let cancelado = false;

    const verificar = async () => {
      if (await servidorDisponivel()) {
        if (cancelado) return;
        setVoltou(true);
        try {
          sessionStorage.removeItem(CHAVE_TENTATIVAS);
        } catch {
          // Ignorado: o contador e so uma cortesia.
        }
        // Um instante para a mensagem "voltou" ser lida antes de a pagina trocar.
        setTimeout(recarregar, 800);
      }
    };

    const intervalo = setInterval(() => void verificar(), INTERVALO_VERIFICACAO_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [recarregar]);

  const progresso = ((SEGUNDOS_ATE_RECARREGAR - restante) / SEGUNDOS_ATE_RECARREGAR) * 100;
  const demorando = tentativas >= TENTATIVAS_ATE_AVISO;

  const conteudo = (
    <div
      className={cn(
        'w-full max-w-lg rounded-card border border-borda bg-superficie p-6 sm:p-8',
        variante === 'embutida' && 'mx-auto',
      )}
    >
      <SimboloMarca className="h-10 w-10" />

      <h1 className="mt-5 font-titulo text-titulo-pagina text-texto">
        {voltou ? 'Pronto, o sistema voltou' : 'O sistema está sendo ligado'}
      </h1>

      {!voltou && (
        <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-texto">
          <p>
            Para economizar recursos, o servidor da plataforma <strong>desliga sozinho</strong>{' '}
            quando ninguém usa o sistema por um tempo. O seu acesso acabou de ligá-lo de novo, e
            isso costuma levar <strong>cerca de 1 minuto</strong>.
          </p>
          <p className="text-texto-suave">
            Não é preciso fazer nada: nenhum dado foi perdido, e a página vai recarregar sozinha.
          </p>
        </div>
      )}

      {demorando && !voltou && (
        <p className="mt-4 rounded-md bg-alerta-suave/70 px-3 py-2.5 text-sm text-texto">
          Já é a {tentativas}ª tentativa seguida. Se continuar assim por mais alguns minutos, o
          servidor pode estar com outro problema. Tente novamente mais tarde ou avise o professor
          responsável pela sua monitoria.
        </p>
      )}

      <div className="mt-6" aria-hidden={voltou}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-texto-suave">
            {voltou ? 'Recarregando…' : 'Recarregando automaticamente em'}
          </span>
          {!voltou && (
            <span className="font-titulo text-2xl font-semibold tabular-nums text-texto">
              0:{String(restante).padStart(2, '0')}
            </span>
          )}
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-fundo-suave"
          role="progressbar"
          aria-label="Tempo até recarregar a página"
          aria-valuemin={0}
          aria-valuemax={SEGUNDOS_ATE_RECARREGAR}
          aria-valuenow={SEGUNDOS_ATE_RECARREGAR - restante}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-1000 ease-linear',
              voltou ? 'bg-sucesso' : 'bg-primaria',
            )}
            style={{ width: voltou ? '100%' : `${progresso}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-texto-suave">
          {voltou
            ? 'O servidor respondeu.'
            : 'Também verificamos a cada 10 segundos e recarregamos assim que o servidor responder.'}
        </p>
      </div>

      {/*
        Anuncio para leitor de tela so nos momentos que importam — anunciar
        cada segundo seria ruido.
      */}
      <p className="sr-only" aria-live="polite">
        {voltou
          ? 'O sistema voltou. Recarregando a página.'
          : 'O sistema está sendo ligado. A página recarrega sozinha em até 1 minuto.'}
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={recarregar}
          disabled={voltou}
          iconeEsquerda={<RotateCw className="h-4 w-4" aria-hidden />}
        >
          Recarregar agora
        </Button>
      </div>
    </div>
  );

  if (variante === 'embutida') return <div className="py-6">{conteudo}</div>;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fundo px-4 py-10">
      {conteudo}
    </main>
  );
}
