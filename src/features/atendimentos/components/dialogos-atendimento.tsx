'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/campo';
import { toast } from '@/components/ui/toast';
import {
  cancelarAtendimento,
  reagendarAtendimento,
  realizarAtendimento,
} from '../api/atendimentos.service';
import { mensagemDeErro } from '@/lib/api/erros';
import {
  formatarDataHoraExtensa,
  formatarIntervalo,
  instanteDeDataHoraLocal,
} from '@/lib/datas/fuso';
import { StatusInscricao, type Atendimento, type Inscricao } from '@/types/dominio';

/**
 * Dialogos de transicao do atendimento.
 *
 * Os tres exigem MOTIVO ou decisao por pessoa, entao nao cabem no
 * <DialogoConfirmacao> generico: precisam de campo, validacao e erro proprios.
 *
 * Compartilham o mesmo contrato (`aberto` / `aoFechar` / `aoConcluir`) para que
 * o detalhe os trate de forma uniforme.
 */

interface PropsDialogo {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: () => void;
}

/**
 * AGENDADO -> CANCELADO.
 *
 * O motivo e obrigatorio porque o cancelamento nao apaga nada (RN10): a linha
 * permanece e vai para o historico. Sem motivo, o registro nao explicaria por
 * que o compromisso deixou de existir.
 */
export function DialogoCancelar({
  aberto,
  aoFechar,
  aoConcluir,
  atendimentoId,
}: PropsDialogo & { atendimentoId: string }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const mutacao = useMutation({
    mutationFn: () => cancelarAtendimento(atendimentoId, motivo.trim()),
    onSuccess: () => {
      aoConcluir();
      toast.sucesso('Atendimento cancelado', 'O registro permanece no histórico.');
      setMotivo('');
      aoFechar();
    },
    onError: (falha) => setErro(mensagemDeErro(falha)),
  });

  const valido = motivo.trim().length >= 5 && motivo.trim().length <= 500;

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      {aberto && (
        <DialogConteudo
          titulo="Cancelar atendimento"
          descricao="O registro não é apagado: ele continua consultável, com motivo e autor."
          rodape={
            <>
              <Button variante="secundaria" onClick={aoFechar} disabled={mutacao.isPending}>
                Voltar
              </Button>
              <Button
                variante="perigo"
                carregando={mutacao.isPending}
                disabled={!valido}
                onClick={() => mutacao.mutate()}
              >
                Confirmar cancelamento
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {erro && <Alert tom="erro">{erro}</Alert>}

            <Textarea
              label="Motivo"
              obrigatorio
              autoFocus
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              ajuda="Entre 5 e 500 caracteres."
              placeholder="Ex.: monitor ficou doente."
              erro={
                motivo.length > 0 && !valido ? 'O motivo deve ter entre 5 e 500 caracteres' : undefined
              }
            />

            <Alert tom="alerta">
              As inscrições ativas serão canceladas junto, liberando a agenda dos alunos.
            </Alert>
          </div>
        </DialogConteudo>
      )}
    </Dialog>
  );
}

/**
 * Reagendamento: muda inicio/fim mantendo AGENDADO.
 *
 * As inscricoes acompanham o novo horario por ON UPDATE CASCADE no banco. Se
 * algum inscrito tiver conflito de agenda, o backend recusa o reagendamento
 * INTEIRO com 409 — comportamento correto, e a mensagem diz quem conflita.
 */
export function DialogoReagendar({
  aberto,
  aoFechar,
  aoConcluir,
  atendimento,
  fuso,
}: PropsDialogo & { atendimento: Atendimento; fuso: string }) {
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const mutacao = useMutation({
    mutationFn: () => {
      // Instante montado no fuso da INSTITUIÇÃO, nunca no do navegador.
      const inicio = instanteDeDataHoraLocal(data, horaInicio, fuso);
      const fim = instanteDeDataHoraLocal(data, horaFim, fuso);

      if (!inicio || !fim) throw new Error('Data ou horário inválidos.');

      return reagendarAtendimento(atendimento.id, { inicio, fim, motivo: motivo.trim() });
    },
    onSuccess: () => {
      aoConcluir();
      toast.sucesso('Atendimento reagendado', 'As inscrições acompanharam o novo horário.');
      aoFechar();
    },
    onError: (falha) => setErro(mensagemDeErro(falha)),
  });

  const valido =
    Boolean(data) &&
    Boolean(horaInicio) &&
    Boolean(horaFim) &&
    horaFim > horaInicio &&
    motivo.trim().length >= 5;

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      {aberto && (
        <DialogConteudo
          titulo="Reagendar atendimento"
          descricao="As inscrições acompanham o novo horário automaticamente."
          rodape={
            <>
              <Button variante="secundaria" onClick={aoFechar} disabled={mutacao.isPending}>
                Voltar
              </Button>
              <Button
                carregando={mutacao.isPending}
                disabled={!valido}
                onClick={() => mutacao.mutate()}
              >
                Reagendar
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {erro && <Alert tom="erro">{erro}</Alert>}

            <p className="text-sm text-texto-suave">
              Atual: {formatarDataHoraExtensa(atendimento.inicio, fuso)} ·{' '}
              {formatarIntervalo(atendimento.inicio, atendimento.fim, fuso)}
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Nova data"
                type="date"
                obrigatorio
                value={data}
                onChange={(evento) => setData(evento.target.value)}
              />
              <Input
                label="Início"
                type="time"
                obrigatorio
                value={horaInicio}
                onChange={(evento) => setHoraInicio(evento.target.value)}
              />
              <Input
                label="Término"
                type="time"
                obrigatorio
                value={horaFim}
                onChange={(evento) => setHoraFim(evento.target.value)}
              />
            </div>

            <Textarea
              label="Motivo"
              obrigatorio
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              ajuda="Entre 5 e 500 caracteres. Fica registrado no histórico."
            />

            <Alert tom="alerta">
              Se algum inscrito tiver conflito de agenda no novo horário, o reagendamento inteiro
              será recusado.
            </Alert>
          </div>
        </DialogConteudo>
      )}
    </Dialog>
  );
}

/**
 * Registrar realizacao = registrar PRESENCA.
 *
 * Como a sessao pode ser coletiva, faltar e um fato POR PESSOA: o atendimento
 * aconteceu, e um aluno especifico nao compareceu. Por isso a UI marca ausentes,
 * e nao um status do atendimento inteiro.
 *
 * O backend recebe IDS DE INSCRICAO; quem nao for listado e considerado PRESENTE.
 */
export function DialogoRealizar({
  aberto,
  aoFechar,
  aoConcluir,
  atendimento,
}: PropsDialogo & { atendimento: Atendimento }) {
  const [ausentes, setAusentes] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const inscritos = (atendimento.inscricoes ?? []).filter(
    (inscricao) => inscricao.status === StatusInscricao.INSCRITO,
  );

  const mutacao = useMutation({
    mutationFn: () => realizarAtendimento(atendimento.id, ausentes),
    onSuccess: () => {
      aoConcluir();
      toast.sucesso('Atendimento realizado', 'As presenças foram registradas.');
      setAusentes([]);
      aoFechar();
    },
    onError: (falha) => setErro(mensagemDeErro(falha)),
  });

  const alternar = (inscricao: Inscricao) => {
    setAusentes((atual) =>
      atual.includes(inscricao.id)
        ? atual.filter((id) => id !== inscricao.id)
        : [...atual, inscricao.id],
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      {aberto && (
        <DialogConteudo
          titulo="Registrar realização"
          descricao="Marque quem não compareceu. Os demais são registrados como presentes."
          rodape={
            <>
              <Button variante="secundaria" onClick={aoFechar} disabled={mutacao.isPending}>
                Voltar
              </Button>
              <Button carregando={mutacao.isPending} onClick={() => mutacao.mutate()}>
                Confirmar realização
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {erro && <Alert tom="erro">{erro}</Alert>}

            {inscritos.length === 0 ? (
              <Alert tom="alerta">
                Nenhum aluno inscrito nesta sessão. Ela pode ser marcada como realizada mesmo assim.
              </Alert>
            ) : (
              <ul className="space-y-2">
                {inscritos.map((inscricao) => {
                  const ausente = ausentes.includes(inscricao.id);

                  return (
                    <li key={inscricao.id}>
                      <label className="flex items-center gap-3 rounded-lg border border-borda p-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-borda text-perigo"
                          checked={ausente}
                          onChange={() => alternar(inscricao)}
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block truncate text-texto">
                            {inscricao.nomeAluno ?? 'Monitorado'}
                          </span>
                          <span className="block text-xs text-texto-suave">
                            {ausente ? 'Não compareceu' : 'Presente'}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <Alert tom="info">
              Só quem tiver <strong>presença</strong> registrada poderá avaliar o atendimento
              (RN06).
            </Alert>
          </div>
        </DialogConteudo>
      )}
    </Dialog>
  );
}
