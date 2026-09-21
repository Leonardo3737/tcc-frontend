'use client';

import { useState, type ReactNode } from 'react';

import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

/**
 * Confirmacao de acao irreversivel (ou trabalhosa de desfazer).
 *
 * Vale a pena distinguir dois casos neste dominio:
 *
 *  - acoes que EXIGEM MOTIVO (cancelar atendimento, cancelar monitoria) tem
 *    dialogo proprio, porque o motivo vai para o historico e precisa de campo,
 *    validacao e mensagem de erro;
 *  - acoes sem motivo (remover material, encerrar vinculo, desativar horario)
 *    usam este componente.
 *
 * Nenhuma delas apaga dado de verdade — RN10 vale para toda a API. Ainda assim,
 * "remover" some das listagens e "encerrar" tira o acesso: pedir confirmacao
 * evita o clique acidental que o usuario nao consegue desfazer sozinho.
 *
 * O botao de confirmar recebe `autoFocus` de proposito: quem chegou aqui pelo
 * teclado confirma com Enter, e quem quer sair usa Escape (tratado pelo Radix).
 */
export function DialogoConfirmacao({
  aberto,
  aoFechar,
  aoConfirmar,
  titulo,
  descricao,
  rotuloConfirmar = 'Confirmar',
  destrutivo = true,
  carregando = false,
  aviso,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
  titulo: string;
  descricao: string;
  rotuloConfirmar?: string;
  destrutivo?: boolean;
  carregando?: boolean;
  /** Consequência que o usuário precisa saber ANTES de confirmar. */
  aviso?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && !carregando && aoFechar()}>
      {aberto && (
        <DialogConteudo
          titulo={titulo}
          descricao={descricao}
          rodape={
            <>
              <Button variante="secundaria" onClick={aoFechar} disabled={carregando}>
                Cancelar
              </Button>
              <Button
                variante={destrutivo ? 'perigo' : 'primaria'}
                carregando={carregando}
                onClick={aoConfirmar}
                autoFocus
              >
                {rotuloConfirmar}
              </Button>
            </>
          }
        >
          {(aviso || children) && (
            <div className="space-y-3">
              {aviso && <Alert tom="alerta">{aviso}</Alert>}
              {children}
            </div>
          )}
        </DialogConteudo>
      )}
    </Dialog>
  );
}

/**
 * Estado do dialogo de confirmacao.
 *
 * Guarda o ALVO (o item sobre o qual se confirma) junto do estado de abertura —
 * sem isso, cada lista precisaria de dois `useState` sincronizados na mao, e o
 * dialogo poderia abrir com o alvo da iteracao anterior.
 */
export function useConfirmacao<T>() {
  const [alvo, setAlvo] = useState<T | null>(null);

  return {
    alvo,
    aberto: alvo !== null,
    pedirConfirmacao: (valor: T) => setAlvo(valor),
    fechar: () => setAlvo(null),
  };
}
