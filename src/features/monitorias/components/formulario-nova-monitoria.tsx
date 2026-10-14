'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { GraduationCap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { Carregando } from '@/components/ui/estados';
import { toast } from '@/components/ui/toast';
import { criarMonitoria } from '../api/monitorias.service';
import { listarDisciplinas } from '@/features/disciplinas/api/disciplinas.service';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { chaves } from '@/lib/query/chaves';
import { rotas } from '@/config/rotas';

/** Espelha criar-monitoria.dto.ts. */
const esquema = z
  .object({
    disciplinaId: z.string().uuid('Selecione uma disciplina'),
    ano: z.coerce
      .number()
      .int('O ano deve ser um número inteiro')
      .min(2000, 'O ano deve ser no mínimo 2000')
      .max(2100, 'O ano deve ser no máximo 2100'),
    semestre: z.coerce.number().int().min(1, 'Selecione o semestre').max(2, 'Selecione o semestre'),
    descricao: z.string().trim().max(2000, 'Máximo de 2000 caracteres').optional(),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
  })
  // Mesma checagem que o service do backend faz em `validarVigencia`.
  .refine((dados) => !dados.dataInicio || !dados.dataFim || dados.dataFim >= dados.dataInicio, {
    path: ['dataFim'],
    message: 'A data de término não pode ser anterior à de início',
  });

type DadosNovaMonitoria = z.infer<typeof esquema>;

const CAMPOS = ['disciplinaId', 'ano', 'semestre', 'descricao', 'dataInicio', 'dataFim'] as const;

export function FormularioNovaMonitoria() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const agora = new Date();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosNovaMonitoria>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: {
      disciplinaId: '',
      ano: agora.getFullYear(),
      // Julho em diante já é o segundo semestre na maioria dos calendários.
      semestre: agora.getMonth() >= 6 ? 2 : 1,
      descricao: '',
      dataInicio: '',
      dataFim: '',
    },
  });

  /**
   * Só disciplinas ATIVAS: o backend recusa criar monitoria de disciplina
   * inativa com 400. Oferecer a opção e depois rejeitar seria um beco sem saída.
   */
  const disciplinas = useQuery({
    queryKey: chaves.disciplinas.lista({ ativa: true, limite: 100 }),
    queryFn: () => listarDisciplinas({ ativa: true, limite: 100 }),
    staleTime: 5 * 60_000,
  });

  const mutacao = useMutation({
    mutationFn: criarMonitoria,
    onSuccess: (monitoria) => {
      void queryClient.invalidateQueries({ queryKey: chaves.monitorias.raiz });
      toast.sucesso('Monitoria criada', 'Ela nasce PLANEJADA. Ative-a para aceitar atendimentos.');
      router.replace(rotas.monitoria(monitoria.id));
    },
    // 409 = já existe monitoria desta disciplina para você neste período
    // (uq_monitoria_oferta). O backend devolve a mensagem pronta.
    onError: (erro) => aplicarErroDeFormulario(erro, setError, CAMPOS),
  });

  const enviando = isSubmitting || mutacao.isPending;

  if (disciplinas.isPending) return <Carregando rotulo="Carregando disciplinas…" />;

  if (disciplinas.isSuccess && disciplinas.data.dados.length === 0) {
    return (
      <Alert tom="alerta" titulo="Nenhuma disciplina ativa">
        É preciso ter ao menos uma disciplina ativa no catálogo para criar uma monitoria.{' '}
        <a href={rotas.disciplinas} className="font-medium underline">
          Cadastrar disciplina
        </a>
      </Alert>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((dados) =>
        mutacao.mutate({
          disciplinaId: dados.disciplinaId,
          ano: dados.ano,
          semestre: dados.semestre,
          // Campos vazios são omitidos: `forbidNonWhitelisted` está ligado no
          // backend, e string vazia falharia a validação de data.
          ...(dados.descricao ? { descricao: dados.descricao } : {}),
          ...(dados.dataInicio ? { dataInicio: dados.dataInicio } : {}),
          ...(dados.dataFim ? { dataFim: dados.dataFim } : {}),
        }),
      )}
      className="space-y-5"
      noValidate
    >
      {errors.root && <Alert tom="erro">{errors.root.message}</Alert>}

      <Select
        label="Disciplina"
        obrigatorio
        autoFocus
        placeholder="Selecione a disciplina"
        erro={errors.disciplinaId?.message}
        opcoes={(disciplinas.data?.dados ?? []).map((disciplina) => ({
          valor: disciplina.id,
          rotulo: `${disciplina.codigo} — ${disciplina.nome}`,
        }))}
        {...register('disciplinaId')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Ano"
          type="number"
          inputMode="numeric"
          obrigatorio
          erro={errors.ano?.message}
          {...register('ano')}
        />

        <Select
          label="Semestre"
          obrigatorio
          erro={errors.semestre?.message}
          opcoes={[
            { valor: '1', rotulo: '1º semestre' },
            { valor: '2', rotulo: '2º semestre' },
          ]}
          {...register('semestre')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Início da vigência"
          type="date"
          ajuda="Opcional."
          erro={errors.dataInicio?.message}
          {...register('dataInicio')}
        />

        <Input
          label="Fim da vigência"
          type="date"
          ajuda="Opcional."
          erro={errors.dataFim?.message}
          {...register('dataFim')}
        />
      </div>

      <Textarea
        label="Descrição"
        placeholder="Foco da monitoria, formato dos encontros, materiais de apoio…"
        ajuda="Opcional. Aparece para os alunos no catálogo."
        erro={errors.descricao?.message}
        {...register('descricao')}
      />

      <Alert tom="info">
        A monitoria é criada como <strong>PLANEJADA</strong>. Alunos já podem se inscrever, mas o
        agendamento de atendimentos só é liberado depois de você ativá-la.
      </Alert>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variante="secundaria" onClick={() => router.back()} disabled={enviando}>
          Cancelar
        </Button>

        <Button
          type="submit"
          carregando={enviando}
          iconeEsquerda={<GraduationCap className="h-4 w-4" aria-hidden />}
        >
          {enviando ? 'Criando…' : 'Criar monitoria'}
        </Button>
      </div>
    </form>
  );
}
