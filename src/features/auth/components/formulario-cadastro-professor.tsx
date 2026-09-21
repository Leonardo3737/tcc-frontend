'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { registrarProfessor } from '../api/cadastro.service';
import {
  CAMPOS_CADASTRO_PROFESSOR,
  esquemaCadastroProfessor,
  type DadosCadastroProfessor,
} from '../schemas/cadastro.schema';
import { ApiError, mensagemDeErro, separarErrosPorCampo } from '@/lib/api/erros';
import { rotas } from '@/config/rotas';

export function FormularioCadastroProfessor() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosCadastroProfessor>({
    resolver: zodResolver(esquemaCadastroProfessor),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      nome: '',
      email: '',
      senha: '',
      confirmacaoSenha: '',
      identificacaoFuncional: '',
      departamento: '',
      codigoCadastro: '',
    },
  });

  const cadastro = useMutation({
    mutationFn: registrarProfessor,

    onSuccess: () => {
      toast.sucesso('Conta criada com sucesso', 'Entre com o seu e-mail e senha.');
      router.replace(rotas.login);
    },

    onError: (erro: unknown) => {
      if (!(erro instanceof ApiError)) return;

      if (erro.ehValidacao && erro.detalhes.length > 0) {
        const { porCampo, gerais } = separarErrosPorCampo(erro.detalhes, CAMPOS_CADASTRO_PROFESSOR);

        for (const [campo, mensagem] of Object.entries(porCampo)) {
          setError(campo as keyof DadosCadastroProfessor, { type: 'server', message: mensagem });
        }

        if (gerais.length > 0) {
          setError('root', { type: 'server', message: gerais.join(' ') });
        }

        return;
      }

      /**
       * 403 aqui significa exatamente uma coisa: o servidor exige
       * CODIGO_CADASTRO_PROFESSOR e o codigo informado esta errado ou ausente.
       * O backend fecha esse cadastro porque professor habilita monitores (RN01)
       * — deixar o auto-cadastro aberto tornaria a RN01 decorativa.
       *
       * Apontar o erro para o campo, e nao para o topo do formulario, e o que
       * torna a correcao obvia.
       */
      if (erro.ehProibido) {
        setError('codigoCadastro', { type: 'server', message: erro.message });
        return;
      }

      setError('root', { type: 'server', message: mensagemDeErro(erro) });
    },
  });

  const enviando = isSubmitting || cadastro.isPending;

  return (
    <form onSubmit={handleSubmit((dados) => cadastro.mutate(dados))} className="space-y-4" noValidate>
      {errors.root && (
        <Alert tom="erro" titulo="Não foi possível concluir o cadastro">
          {errors.root.message}
        </Alert>
      )}

      <Input
        label="Nome completo"
        autoComplete="name"
        autoFocus
        obrigatorio
        erro={errors.nome?.message}
        {...register('nome')}
      />

      <Input
        label="E-mail institucional"
        type="email"
        inputMode="email"
        autoComplete="username"
        placeholder="voce@instituicao.edu.br"
        obrigatorio
        erro={errors.email?.message}
        {...register('email')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Identificação funcional"
          autoComplete="off"
          ajuda="SIAPE ou matrícula funcional. Opcional."
          erro={errors.identificacaoFuncional?.message}
          {...register('identificacaoFuncional')}
        />

        <Input
          label="Departamento"
          autoComplete="organization"
          ajuda="Opcional."
          erro={errors.departamento?.message}
          {...register('departamento')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          obrigatorio
          ajuda="Ao menos 8 caracteres."
          erro={errors.senha?.message}
          {...register('senha')}
        />

        <Input
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          obrigatorio
          erro={errors.confirmacaoSenha?.message}
          {...register('confirmacaoSenha')}
        />
      </div>

      <Input
        label="Código de cadastro"
        autoComplete="off"
        ajuda="Exigido apenas se a instituição tiver fechado o cadastro de docentes."
        erro={errors.codigoCadastro?.message}
        {...register('codigoCadastro')}
      />

      <Button
        type="submit"
        carregando={enviando}
        className="w-full"
        tamanho="lg"
        iconeEsquerda={<UserPlus className="h-4 w-4" aria-hidden />}
      >
        {enviando ? 'Criando conta…' : 'Criar conta'}
      </Button>
    </form>
  );
}
