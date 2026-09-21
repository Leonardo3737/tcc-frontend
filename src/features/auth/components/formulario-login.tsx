'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { esquemaLogin, type DadosLogin } from '../schemas/login.schema';
import { useLogin } from '../hooks/use-login';
import { ApiError } from '@/lib/api/erros';

export function FormularioLogin() {
  const parametros = useSearchParams();
  const sessaoExpirou = parametros.get('expirou') === '1';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosLogin>({
    resolver: zodResolver(esquemaLogin),
    // Valida ao sair do campo e reavalida enquanto digita: nao acusa erro
    // enquanto a pessoa ainda esta escrevendo o e-mail.
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { email: '', senha: '' },
  });

  const login = useLogin(setError);

  // `isSubmitting` cobre a validacao; `isPending`, a requisicao. Os dois juntos
  // sao o que impede o duplo envio — critico aqui, porque o backend limita o
  // login a 5 tentativas por minuto e cliques repetidos gastam esse orcamento.
  const enviando = isSubmitting || login.isPending;

  const excedeuTentativas = login.error instanceof ApiError && login.error.ehExcessoDeRequisicoes;

  return (
    <form
      onSubmit={handleSubmit((dados) => login.mutate(dados))}
      className="space-y-4"
      noValidate
    >
      {sessaoExpirou && !errors.root && (
        <Alert tom="alerta" titulo="Sua sessão expirou">
          Entre novamente para continuar de onde parou.
        </Alert>
      )}

      {/*
        O TEXTO vem pronto de `mensagemDeErro` (via useLogin) — inclusive o do
        429, cuja mensagem crua do backend seria "ThrottlerException: Too Many
        Requests". Aqui so ajustamos o TITULO, que depende do contexto da tela.
      */}
      {errors.root && (
        <Alert tom="erro" titulo={excedeuTentativas ? 'Muitas tentativas' : 'Não foi possível entrar'}>
          {errors.root.message}
        </Alert>
      )}

      <Input
        label="E-mail institucional"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoFocus
        placeholder="voce@instituicao.edu.br"
        obrigatorio
        erro={errors.email?.message}
        {...register('email')}
      />

      <Input
        label="Senha"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        obrigatorio
        erro={errors.senha?.message}
        {...register('senha')}
      />

      <Button
        type="submit"
        carregando={enviando}
        className="w-full"
        tamanho="lg"
        iconeEsquerda={<LogIn className="h-4 w-4" aria-hidden />}
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
