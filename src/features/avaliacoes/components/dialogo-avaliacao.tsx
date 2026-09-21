'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';

import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { avaliarAtendimento } from '../api/avaliacoes.service';
import { mensagemDeErro } from '@/lib/api/erros';
import { chaves } from '@/lib/query/chaves';
import { cn } from '@/lib/utils';

const NOTAS = [1, 2, 3, 4, 5] as const;

const ROTULOS: Record<number, string> = {
  1: 'Muito abaixo do esperado',
  2: 'Abaixo do esperado',
  3: 'Atendeu',
  4: 'Bom',
  5: 'Excelente',
};

/**
 * Avaliacao de um atendimento realizado.
 *
 * So chega aqui quem o backend marcou com `podeAvaliar` na propria inscricao —
 * ou seja, atendimento REALIZADO, presenca confirmada (RN06) e ainda nao
 * avaliado. Nao reimplementamos essa decisao no cliente.
 *
 * A avaliacao e IMUTAVEL depois de enviada (D-10), e o formulario diz isso antes
 * do envio: nao ha tela de edicao para oferecer depois.
 */
export function DialogoAvaliacao({
  aberto,
  aoFechar,
  atendimentoId,
  nomeMonitor,
}: {
  aberto: boolean;
  aoFechar: () => void;
  atendimentoId: string;
  nomeMonitor?: string;
}) {
  const queryClient = useQueryClient();
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    setNota(null);
    setComentario('');
    setErro(null);
    aoFechar();
  };

  const mutacao = useMutation({
    mutationFn: () =>
      avaliarAtendimento(atendimentoId, {
        nota: nota!,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      }),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaves.atendimentos.detalhe(atendimentoId) });
      void queryClient.invalidateQueries({ queryKey: chaves.atendimentos.avaliacoes(atendimentoId) });
      // A avaliação gera pontos para o monitor (evento de gamificação).
      void queryClient.invalidateQueries({ queryKey: chaves.gamificacao.raiz });

      toast.sucesso('Avaliação registrada', 'Obrigado pelo retorno.');
      fechar();
    },

    /**
     * 409 possíveis: atendimento não realizado, cancelado, sem presença
     * registrada, ou já avaliado. Todos com mensagem de domínio pronta.
     */
    onError: (falha) => setErro(mensagemDeErro(falha)),
  });

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && fechar()}>
      {aberto && (
        <DialogConteudo
          titulo="Avaliar atendimento"
          descricao={
            nomeMonitor
              ? `Como foi o atendimento com ${nomeMonitor}?`
              : 'Como foi este atendimento?'
          }
          rodape={
            <>
              <Button variante="secundaria" onClick={fechar} disabled={mutacao.isPending}>
                Cancelar
              </Button>
              <Button
                carregando={mutacao.isPending}
                disabled={nota === null}
                onClick={() => mutacao.mutate()}
              >
                Enviar avaliação
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {erro && <Alert tom="erro">{erro}</Alert>}

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-texto">
                Nota <span className="text-perigo">*</span>
              </legend>

              {/*
                Estrelas como radiogroup de verdade: navegável por teclado e com
                rótulo textual por nota. Estrela sozinha não comunica nada para
                leitor de tela.
              */}
              <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Nota">
                {NOTAS.map((valor) => {
                  const selecionada = nota !== null && valor <= nota;

                  return (
                    <button
                      key={valor}
                      type="button"
                      role="radio"
                      aria-checked={nota === valor}
                      aria-label={`${valor} — ${ROTULOS[valor]}`}
                      onClick={() => setNota(valor)}
                      className="alvo-toque rounded-lg p-1.5 transition-colors hover:bg-fundo"
                    >
                      <Star
                        className={cn(
                          'h-7 w-7 transition-colors',
                          selecionada ? 'fill-alerta text-alerta' : 'text-borda',
                        )}
                        aria-hidden
                      />
                    </button>
                  );
                })}

                {nota !== null && (
                  <span className="ml-2 text-sm text-texto-suave">{ROTULOS[nota]}</span>
                )}
              </div>
            </fieldset>

            <Textarea
              label="Comentário"
              rows={4}
              value={comentario}
              onChange={(evento) => setComentario(evento.target.value)}
              ajuda="Opcional. Máximo de 2000 caracteres."
              placeholder="O que ajudou? O que poderia ser melhor?"
              erro={comentario.length > 2000 ? 'Máximo de 2000 caracteres' : undefined}
            />

            <Alert tom="info">
              A avaliação é <strong>imutável</strong> depois de enviada, e o monitor vê a nota
              sem saber quem a deu.
            </Alert>
          </div>
        </DialogConteudo>
      )}
    </Dialog>
  );
}
