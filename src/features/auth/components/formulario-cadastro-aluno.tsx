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
import { registrarAluno } from '../api/cadastro.service';
import {
  CAMPOS_CADASTRO_ALUNO,
  esquemaCadastroAluno,
  type DadosCadastroAluno,
} from '../schemas/cadastro.schema';
import { ApiError, mensagemDeErro, separarErrosPorCampo } from '@/lib/api/erros';
import { rotas } from '@/config/rotas';

export function FormularioCadastroAluno() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosCadastroAluno>({
    resolver: zodResolver(esquemaCadastroAluno),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { nome: '', email: '', senha: '', confirmacaoSenha: '', matricula: '', curso: '' },
  });

  const cadastro = useMutation({
    mutationFn: registrarAluno,

    onSuccess: () => {
      // O registro nao autentica: o backend devolve o usuario, nao um token.
      // Levar direto ao login e o caminho honesto.
      toast.sucesso('Conta criada com sucesso', 'Entre com o seu e-mail e senha.');
      router.replace(rotas.login);
    },

    onError: (erro: unknown) => {
      if (!(erro instanceof ApiError)) return;

      if (erro.ehValidacao && erro.detalhes.length > 0) {
        const { porCampo, gerais } = separarErrosPorCampo(erro.detalhes, CAMPOS_CADASTRO_ALUNO);

        for (const [campo, mensagem] of Object.entries(porCampo)) {
          setError(campo as keyof DadosCadastroAluno, { type: 'server', message: mensagem });
        }

        if (gerais.length > 0) {
          setError('root', { type: 'server', message: gerais.join(' ') });
        }

        return;
      }

      /**
       * 409 aqui e sempre e-mail ou matricula ja cadastrados — o filtro de
       * excecoes do backend traduz a constraint (`usuarios_email_key`,
       * `alunos_matricula_key`) numa mensagem de dominio pronta para exibir.
       * 400 tambem chega assim quando o e-mail esta fora do dominio institucional.
       */
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

      <Input
        label="Matrícula"
        autoComplete="off"
        obrigatorio
        ajuda="De 3 a 30 caracteres: letras, números, ponto, hífen ou underscore."
        erro={errors.matricula?.message}
        {...register('matricula')}
      />

      <Input
        label="Curso"
        autoComplete="organization-title"
        ajuda="Opcional."
        erro={errors.curso?.message}
        {...register('curso')}
      />

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
