'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/campo';
import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { chaves } from '@/lib/query/chaves';
import type { Edital } from '@/types/dominio';
import { atualizarEdital, criarEdital } from '../api/editais.service';

/** Espelha criar-edital.dto.ts e atualizar-edital.dto.ts. */
const esquema = z
  .object({
    ano: z.coerce
      .number()
      .int('Informe um ano válido')
      .min(2000, 'O ano deve ser no mínimo 2000')
      .max(2100, 'O ano deve ser no máximo 2100'),
    semestre: z.coerce.number().int().min(1).max(2),
    inicioInscricoes: z.string().min(1, 'Informe a data de início'),
    fimInscricoes: z.string().min(1, 'Informe a data de encerramento'),
    link: z
      .string()
      .trim()
      .min(1, 'Informe o link do edital oficial')
      .max(2048, 'O link deve ter no máximo 2048 caracteres')
      .url('Informe uma URL completa, começando com http:// ou https://'),
  })
  /**
   * O periodo invertido e recusado pelo banco (CHECK `ck_edital_periodo`) e
   * devolvido como 409. Conferir aqui evita a ida ao servidor para receber de
   * volta algo que a tela ja sabia — a comparacao de strings 'AAAA-MM-DD' e
   * exata, porque nesse formato a ordem lexicografica e a cronologica.
   */
  .refine((dados) => dados.fimInscricoes >= dados.inicioInscricoes, {
    path: ['fimInscricoes'],
    message: 'O encerramento não pode ser antes do início',
  });

type DadosFormularioEdital = z.infer<typeof esquema>;

const CAMPOS = ['ano', 'semestre', 'inicioInscricoes', 'fimInscricoes', 'link'] as const;

/**
 * Criacao e edicao de edital no mesmo dialogo.
 *
 * Diferente de curso e disciplina, aqui TODOS os campos sao editaveis,
 * inclusive as datas: um edital nao tem identidade derivada de campo nenhum
 * (nao ha codigo gerado), e corrigir uma data digitada errada e operacao
 * legitima.
 */
export function DialogoEdital({
  aberto,
  aoFechar,
  edital,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Ausente = criacao. */
  edital?: Edital;
  /** Recebe o edital devolvido pelo SERVIDOR, nunca o que foi digitado. */
  aoSalvar?: (edital: Edital) => void;
}) {
  const queryClient = useQueryClient();
  const editando = Boolean(edital);
  const agora = new Date();

  const valoresIniciais: DadosFormularioEdital = edital
    ? {
        ano: edital.ano,
        semestre: edital.semestre,
        inicioInscricoes: edital.inicioInscricoes,
        fimInscricoes: edital.fimInscricoes,
        link: edital.link,
      }
    : {
        ano: agora.getFullYear(),
        // Julho em diante já é o segundo semestre na maioria dos calendários.
        semestre: agora.getMonth() >= 6 ? 2 : 1,
        inicioInscricoes: '',
        fimInscricoes: '',
        link: '',
      };

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DadosFormularioEdital>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: valoresIniciais,
  });

  // O dialogo e reaproveitado; sem isto, reabrir mostraria o estado anterior.
  useEffect(() => {
    if (aberto) reset(valoresIniciais);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, edital?.id, reset]);

  const mutacao = useMutation({
    mutationFn: (dados: DadosFormularioEdital) =>
      edital ? atualizarEdital(edital.id, dados) : criarEdital(dados),

    onSuccess: (salvo) => {
      /**
       * A tela e atualizada a partir do que o SERVIDOR devolveu, nunca do que
       * foi digitado: `aceitandoInscricoes` e derivado la, e supor o valor aqui
       * faria o cabecalho anunciar "inscrições abertas" em um edital que a API
       * ainda considera futuro.
       */
      void queryClient.invalidateQueries({ queryKey: chaves.editais.raiz });
      void queryClient.invalidateQueries({ queryKey: chaves.inscricoes.raiz });

      toast.sucesso(editando ? 'Edital atualizado' : 'Edital criado');
      aoSalvar?.(salvo);
      aoFechar();
    },

    // 409 = periodo invalido. A mensagem do backend ja e de dominio.
    onError: (erro) => aplicarErroDeFormulario(erro, setError, CAMPOS),
  });

  const enviando = isSubmitting || mutacao.isPending;

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      {aberto && (
        <DialogConteudo
          titulo={editando ? 'Editar edital' : 'Novo edital'}
          descricao={
            editando
              ? 'As alterações valem imediatamente, inclusive para a vitrine pública.'
              : 'O período de inscrições é inclusivo nos dois extremos.'
          }
        >
          <form
            onSubmit={handleSubmit((dados) => mutacao.mutate(dados))}
            className="space-y-4"
            noValidate
          >
            {errors.root && <Alert tom="erro">{errors.root.message}</Alert>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Ano"
                type="number"
                inputMode="numeric"
                obrigatorio
                autoFocus
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
                label="Início das inscrições"
                type="date"
                obrigatorio
                erro={errors.inicioInscricoes?.message}
                {...register('inicioInscricoes')}
              />

              <Input
                label="Encerramento"
                type="date"
                obrigatorio
                ajuda="O último dia aceita inscrição."
                erro={errors.fimInscricoes?.message}
                {...register('fimInscricoes')}
              />
            </div>

            <Input
              label="Link do edital oficial"
              type="url"
              inputMode="url"
              placeholder="https://instituicao.edu.br/editais/2026-2-monitoria.pdf"
              obrigatorio
              ajuda="A plataforma não hospeda o documento: ela aponta para onde a instituição o publica."
              erro={errors.link?.message}
              {...register('link')}
            />

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variante="secundaria" onClick={aoFechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" carregando={enviando}>
                {enviando ? 'Salvando…' : editando ? 'Salvar' : 'Criar edital'}
              </Button>
            </div>
          </form>
        </DialogConteudo>
      )}
    </Dialog>
  );
}
