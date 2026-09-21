'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCheck, UserPlus, Users } from 'lucide-react';

import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { EstadoVazio } from '@/components/ui/estados';
import { Skeleton } from '@/components/ui/skeleton';
import { CampoBusca } from '@/components/comum/campo-busca';
import { toast } from '@/components/ui/toast';
import { habilitarMonitor, inscreverMonitorado } from '../api/monitorias.service';
import { listarAlunos } from '@/features/usuarios/api/alunos.service';
import { mensagemDeErro } from '@/lib/api/erros';
import { chaves } from '@/lib/query/chaves';
import { PapelMonitoria } from '@/types/dominio';
import { iniciais } from '@/lib/utils';

/**
 * Adiciona um aluno a monitoria, com papel definido pela ACAO escolhida.
 *
 * O papel vem da rota no backend (`/monitores` ou `/monitorados`), nunca de um
 * campo do corpo — nao existe endpoint generico "criar participante com papel X".
 * Aqui isso aparece como dois botoes distintos por aluno, e nao como um seletor
 * de papel: sao operacoes de dominio diferentes (habilitar monitor é RN01), com
 * significados diferentes.
 *
 * IMPORTANTE: `alunoId` é o id do USUÁRIO. As tabelas `alunos`/`professores` têm
 * `usuario_id` como PK, então não existe um "id de aluno" separado.
 */
export function DialogoAdicionarParticipante({
  aberto,
  aoFechar,
  monitoriaId,
}: {
  aberto: boolean;
  aoFechar: () => void;
  monitoriaId: string;
}) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const alunos = useQuery({
    queryKey: chaves.alunos.lista({ busca, monitoriaId }),
    // Só busca depois de digitar algo: a base institucional inteira paginada
    // às cegas não ajuda ninguém.
    enabled: aberto && busca.trim().length >= 2,
    queryFn: () =>
      listarAlunos({
        busca: busca.trim(),
        semVinculoAtivoNaMonitoria: monitoriaId,
        limite: 10,
      }),
  });

  const aoConcluir = (mensagem: string) => {
    void queryClient.invalidateQueries({ queryKey: chaves.monitorias.detalhe(monitoriaId) });
    void queryClient.invalidateQueries({ queryKey: chaves.monitorias.raiz });
    toast.sucesso(mensagem);
    setErro(null);
  };

  const adicionar = useMutation({
    mutationFn: ({ alunoId, papel }: { alunoId: string; papel: PapelMonitoria }) =>
      papel === PapelMonitoria.MONITOR
        ? habilitarMonitor(monitoriaId, alunoId)
        : inscreverMonitorado(monitoriaId, alunoId),

    onSuccess: (_dado, variaveis) => {
      aoConcluir(
        variaveis.papel === PapelMonitoria.MONITOR
          ? 'Aluno habilitado como monitor'
          : 'Aluno inscrito como monitorado',
      );
      void alunos.refetch();
    },

    // 409 = RN09 (já tem vínculo ativo). O filtro do backend torna isso raro,
    // mas duas abas abertas ainda produzem a corrida.
    onError: (falha) => setErro(mensagemDeErro(falha)),
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado) {
          setBusca('');
          setErro(null);
          aoFechar();
        }
      }}
    >
      {aberto && (
        <DialogConteudo
          titulo="Adicionar participante"
          descricao="Busque pelo nome, matrícula ou e-mail. Alunos que já participam não aparecem."
        >
          <div className="space-y-4">
            {erro && <Alert tom="erro">{erro}</Alert>}

            <CampoBusca
              valorInicial=""
              aoBuscar={setBusca}
              placeholder="Nome, matrícula ou e-mail…"
              rotulo="Buscar aluno"
              carregando={alunos.isFetching}
            />

            {busca.trim().length < 2 && (
              <EstadoVazio
                icone={<Users className="h-7 w-7" aria-hidden />}
                titulo="Digite para buscar"
                descricao="Informe ao menos 2 caracteres do nome, da matrícula ou do e-mail."
                className="py-8"
              />
            )}

            {alunos.isFetching && busca.trim().length >= 2 && (
              <div className="space-y-2">
                {[0, 1, 2].map((indice) => (
                  <Skeleton key={indice} className="h-16 w-full" />
                ))}
              </div>
            )}

            {alunos.isSuccess && !alunos.isFetching && alunos.data.dados.length === 0 && (
              <EstadoVazio
                titulo="Nenhum aluno encontrado"
                descricao={`Nada corresponde a “${busca}”, ou o aluno já participa desta monitoria.`}
                className="py-8"
              />
            )}

            {alunos.isSuccess && alunos.data.dados.length > 0 && (
              <ul className="space-y-2">
                {alunos.data.dados.map((aluno) => (
                  <li
                    key={aluno.id}
                    className="flex flex-col gap-2 rounded-lg border border-borda p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primaria-suave text-xs font-semibold text-primaria"
                      >
                        {iniciais(aluno.nome)}
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-texto">
                          {aluno.nome}
                        </span>
                        <span className="block truncate text-xs text-texto-suave">
                          {aluno.aluno?.matricula}
                          {aluno.aluno?.curso ? ` · ${aluno.aluno.curso}` : ''}
                        </span>
                      </span>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        tamanho="sm"
                        disabled={adicionar.isPending}
                        onClick={() =>
                          adicionar.mutate({ alunoId: aluno.id, papel: PapelMonitoria.MONITOR })
                        }
                        iconeEsquerda={<UserCheck className="h-3.5 w-3.5" aria-hidden />}
                      >
                        Monitor
                      </Button>

                      <Button
                        variante="secundaria"
                        tamanho="sm"
                        disabled={adicionar.isPending}
                        onClick={() =>
                          adicionar.mutate({ alunoId: aluno.id, papel: PapelMonitoria.MONITORADO })
                        }
                        iconeEsquerda={<UserPlus className="h-3.5 w-3.5" aria-hidden />}
                      >
                        Monitorado
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Alert tom="info">
              <strong>Habilitar como monitor</strong> é o ato previsto na RN01 — fica
              registrado que foi você quem autorizou. Um aluno não pode acumular os dois
              papéis na mesma monitoria.
            </Alert>
          </div>
        </DialogConteudo>
      )}
    </Dialog>
  );
}
