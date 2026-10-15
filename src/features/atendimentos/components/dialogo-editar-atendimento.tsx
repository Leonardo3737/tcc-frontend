'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { Input } from '@/components/ui/campo';
import { toast } from '@/components/ui/toast';
import { atualizarAtendimento, type DadosEdicaoAtendimento } from '../api/atendimentos.service';
import {
  CAMPOS_EDICAO_ATENDIMENTO,
  VAGAS_MAXIMAS,
  esquemaEdicaoAtendimento,
  type DadosEdicaoAtendimentoForm,
  type DadosEdicaoAtendimentoValidos,
} from '../schemas/edicao-atendimento.schema';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { ROTULO_MODALIDADE } from '@/lib/dominio/rotulos';
import { ModalidadeAtendimento, type Atendimento } from '@/types/dominio';

/**
 * Edicao dos dados basicos de uma sessao AGENDADA: assunto, local e vagas.
 *
 * O que NAO esta aqui, e por que (espelha o DTO do backend):
 *  - horario: muda em "Reagendar", que confere a disponibilidade do monitor e a
 *    agenda de cada inscrito, e registra o motivo no historico;
 *  - modalidade: quem se inscreveu escolheu presencial ou remoto; trocar depois
 *    mudaria o compromisso sem refazer a inscricao. O LOCAL (sala ou link) muda;
 *  - status e monitor: tem acoes proprias (realizar, cancelar) ou definem a
 *    sessao em si.
 *
 * So os campos ALTERADOS vao no corpo: omitir e "nao mexer" no backend, e
 * mandar tudo de novo apagaria a diferenca entre "nao mudei" e "mudei para o
 * mesmo valor".
 */
export function DialogoEditarAtendimento({
  aberto,
  aoFechar,
  aoConcluir,
  atendimento,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: () => void;
  atendimento: Atendimento;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      {aberto && (
        <DialogConteudo
          titulo="Editar atendimento"
          descricao="Assunto, local e número de vagas. Para mudar data ou horário, use Reagendar."
        >
          <Formulario atendimento={atendimento} aoFechar={aoFechar} aoConcluir={aoConcluir} />
        </DialogConteudo>
      )}
    </Dialog>
  );
}

function Formulario({
  atendimento,
  aoFechar,
  aoConcluir,
}: {
  atendimento: Atendimento;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const remoto = atendimento.modalidade === ModalidadeAtendimento.REMOTO;
  const inscritos = atendimento.vagasOcupadas;
  const esquema = useMemo(() => esquemaEdicaoAtendimento(inscritos), [inscritos]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields, isDirty },
  } = useForm<DadosEdicaoAtendimentoForm, unknown, DadosEdicaoAtendimentoValidos>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      assunto: atendimento.assunto,
      local: atendimento.local ?? '',
      vagas: atendimento.vagas,
    },
  });

  const mutacao = useMutation({
    mutationFn: (dados: DadosEdicaoAtendimentoValidos) => {
      const corpo: DadosEdicaoAtendimento = {
        ...(dirtyFields.assunto ? { assunto: dados.assunto } : {}),
        ...(dirtyFields.local ? { local: dados.local } : {}),
        ...(dirtyFields.vagas ? { vagas: dados.vagas } : {}),
      };
      return atualizarAtendimento(atendimento.id, corpo);
    },
    onSuccess: () => {
      aoConcluir();
      toast.sucesso('Atendimento atualizado');
      aoFechar();
    },
    /**
     * 409: o atendimento deixou de estar AGENDADO, ou as vagas ficaram abaixo
     * de inscritos que entraram enquanto o formulario estava aberto. A mensagem
     * do backend ja diz qual — e fica na tela (AD-F05).
     */
    onError: (erro) => aplicarErroDeFormulario(erro, setError, CAMPOS_EDICAO_ATENDIMENTO),
  });

  const enviando = isSubmitting || mutacao.isPending;

  return (
    <form
      onSubmit={handleSubmit((dados) => mutacao.mutate(dados))}
      className="space-y-4"
      noValidate
    >
      {errors.root && <Alert tom="erro">{errors.root.message}</Alert>}

      <Input
        label="Assunto"
        obrigatorio
        autoFocus
        erro={errors.assunto?.message}
        {...register('assunto')}
      />

      <Input
        label={remoto ? 'Link da sala virtual' : 'Local'}
        placeholder={remoto ? 'https://…' : 'Sala, bloco ou laboratório'}
        ajuda="Deixe em branco para remover."
        erro={errors.local?.message}
        {...register('local')}
      />

      <Input
        label="Vagas"
        type="number"
        inputMode="numeric"
        min={Math.max(1, inscritos)}
        max={VAGAS_MAXIMAS}
        obrigatorio
        ajuda={
          inscritos > 0
            ? `${inscritos} ${inscritos === 1 ? 'pessoa inscrita' : 'pessoas inscritas'}: o mínimo é esse número. 1 vaga = atendimento individual.`
            : '1 vaga = atendimento individual.'
        }
        erro={errors.vagas?.message}
        className="sm:max-w-40"
        {...register('vagas', { valueAsNumber: true })}
      />

      <p className="flex gap-2 text-xs text-texto-suave">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          A modalidade ({ROTULO_MODALIDADE[atendimento.modalidade].toLowerCase()}) não muda depois
          do agendamento. Os inscritos não recebem aviso desta edição: eles veem os dados novos ao
          abrir o atendimento.
        </span>
      </p>

      <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
        <Button variante="secundaria" onClick={aoFechar} disabled={enviando}>
          Voltar
        </Button>
        <Button type="submit" carregando={enviando} disabled={!isDirty}>
          {enviando ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  );
}
