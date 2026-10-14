'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { CampoSenha } from './campo-senha';
import { esquemaLogin, type DadosLogin } from '../schemas/login.schema';
import { useLogin } from '../hooks/use-login';
import { ApiError } from '@/lib/api/erros';
import { rotas } from '@/config/rotas';

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
    <form onSubmit={handleSubmit((dados) => login.mutate(dados))} className="space-y-4" noValidate>
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
        <Alert
          tom="erro"
          titulo={excedeuTentativas ? 'Muitas tentativas' : 'Não foi possível entrar'}
        >
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
        ajuda="O mesmo endereço que você usa nos sistemas da instituição."
        erro={errors.email?.message}
        {...register('email')}
      />

      <CampoSenha
        label="Senha"
        autoComplete="current-password"
        placeholder="Sua senha de acesso"
        obrigatorio
        erro={errors.senha?.message}
        {...register('senha')}
      />

      <Button
        type="submit"
        carregando={enviando}
        className="w-full"
        tamanho="lg"
        iconeDireita={!enviando ? <ArrowRight className="h-4 w-4" aria-hidden /> : undefined}
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </Button>

      {/*
        Depois do botao, e nao entre a senha e ele: partindo da senha, o Tab
        deve chegar em "Entrar" (ver CampoSenha). Link, e nao botao — leva a
        outra pagina.
      */}
      <p className="text-center text-sm">
        <Link
          href={rotas.recuperarSenha}
          className="rounded font-semibold text-primaria hover:underline"
        >
          Esqueceu a senha?
        </Link>
      </p>

      {/*
        Dito na tela porque e verdade e porque tranquiliza: a sessao vive num
        cookie httpOnly, e o token nunca fica acessivel ao JavaScript da pagina
        (ver docs/decisoes-arquiteturais.md, AD-F01).
      */}
      <p className="flex items-start gap-2 text-xs text-texto-suave">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-sucesso" aria-hidden />
        Sua sessão fica protegida em um cookie seguro e expira sozinha após 8 horas.
      </p>
    </form>
  );
}
