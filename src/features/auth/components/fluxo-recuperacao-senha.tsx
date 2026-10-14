'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, MailCheck } from 'lucide-react';

import { Button, classesBotao } from '@/components/ui/button';
import { Input } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { CampoSenha } from './campo-senha';
import { confirmarRecuperacao, solicitarRecuperacao } from '../api/recuperacao-senha.service';
import {
  MAX_TENTATIVAS_CODIGO,
  VALIDADE_CODIGO_MINUTOS,
  esquemaConfirmarRecuperacao,
  esquemaSolicitarRecuperacao,
  type DadosConfirmarRecuperacao,
  type DadosConfirmarRecuperacaoValidos,
  type DadosSolicitarRecuperacao,
} from '../schemas/recuperacao-senha.schema';
import { ApiError, mensagemDeErro, separarErrosPorCampo } from '@/lib/api/erros';
import { rotas } from '@/config/rotas';

type Etapa = { nome: 'email' } | { nome: 'codigo'; email: string } | { nome: 'concluido' };

/**
 * Recuperar senha: pedir o codigo, depois codigo + nova senha.
 *
 * O e-mail fica em memoria entre as etapas — nunca na URL (dado pessoal em
 * query string vai parar em historico e logs). Recarregar a pagina volta ao
 * inicio, o que e aceitavel: pedir outro codigo custa um clique.
 *
 * O backend responde igual exista ou nao a conta, entao a tela tambem fala no
 * condicional ("se houver uma conta...") — afirmar "enviamos para voce"
 * revelaria quem tem cadastro.
 */
export function FluxoRecuperacaoSenha() {
  const [etapa, setEtapa] = useState<Etapa>({ nome: 'email' });

  if (etapa.nome === 'concluido') return <Concluido />;

  if (etapa.nome === 'codigo') {
    return (
      <EtapaCodigo
        email={etapa.email}
        aoTrocarEmail={() => setEtapa({ nome: 'email' })}
        aoConcluir={() => setEtapa({ nome: 'concluido' })}
      />
    );
  }

  return <EtapaEmail aoEnviar={(email) => setEtapa({ nome: 'codigo', email })} />;
}

function EtapaEmail({ aoEnviar }: { aoEnviar: (email: string) => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosSolicitarRecuperacao>({
    resolver: zodResolver(esquemaSolicitarRecuperacao),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { email: '' },
  });

  const solicitar = useMutation({
    mutationFn: (dados: DadosSolicitarRecuperacao) => solicitarRecuperacao(dados.email),
    onSuccess: (_, dados) => aoEnviar(dados.email),
    // 429 (3 pedidos por minuto) chega aqui ja traduzido por mensagemDeErro.
    onError: (erro) => setError('root', { type: 'server', message: mensagemDeErro(erro) }),
  });

  const enviando = isSubmitting || solicitar.isPending;

  return (
    <form
      onSubmit={handleSubmit((dados) => solicitar.mutate(dados))}
      className="space-y-4"
      noValidate
    >
      <Cabecalho
        titulo="Recuperar senha"
        descricao="Informe o e-mail da sua conta. Enviaremos um código de 6 dígitos para você criar uma nova senha."
      />

      {errors.root && (
        <Alert tom="erro" titulo="Não foi possível enviar o código">
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

      <Button type="submit" carregando={enviando} tamanho="lg" className="w-full">
        {enviando ? 'Enviando…' : 'Enviar código'}
      </Button>

      <VoltarAoLogin />
    </form>
  );
}

function EtapaCodigo({
  email,
  aoTrocarEmail,
  aoConcluir,
}: {
  email: string;
  aoTrocarEmail: () => void;
  aoConcluir: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<DadosConfirmarRecuperacao, unknown, DadosConfirmarRecuperacaoValidos>({
    resolver: zodResolver(esquemaConfirmarRecuperacao),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { codigo: '', novaSenha: '', confirmacao: '' },
  });

  const confirmar = useMutation({
    mutationFn: (dados: DadosConfirmarRecuperacaoValidos) =>
      confirmarRecuperacao({ email, codigo: dados.codigo, novaSenha: dados.novaSenha }),
    onSuccess: aoConcluir,
    onError: (erro) => {
      if (erro instanceof ApiError && erro.ehValidacao && erro.detalhes.length > 0) {
        const { porCampo, gerais } = separarErrosPorCampo(erro.detalhes, ['codigo', 'novaSenha']);
        for (const [campo, mensagem] of Object.entries(porCampo)) {
          setError(campo as 'codigo' | 'novaSenha', { type: 'server', message: mensagem });
        }
        if (gerais.length > 0) setError('root', { type: 'server', message: gerais.join(' ') });
        return;
      }

      /**
       * Codigo errado, expirado, ja usado ou e-mail sem conta: o backend
       * devolve a MESMA mensagem de proposito. A tela nao tenta adivinhar qual
       * foi — so aponta o proximo passo possivel. O campo do codigo e limpo
       * para a pessoa redigitar sem apagar a mao.
       */
      resetField('codigo');
      setError('root', { type: 'server', message: mensagemDeErro(erro) });
    },
  });

  const reenviar = useMutation({
    mutationFn: () => solicitarRecuperacao(email),
    onSuccess: () => {
      resetField('codigo');
      toast.sucesso('Novo código enviado', 'O código anterior deixou de valer.');
    },
    onError: (erro) => toast.erro('Não foi possível reenviar', mensagemDeErro(erro)),
  });

  const enviando = isSubmitting || confirmar.isPending;

  return (
    <form
      onSubmit={handleSubmit((dados) => confirmar.mutate(dados))}
      className="space-y-4"
      noValidate
    >
      <Cabecalho titulo="Criar nova senha" />

      <div className="flex gap-3 rounded-md bg-primaria-suave/60 px-3 py-2.5 text-sm text-texto">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primaria" aria-hidden />
        <p>
          Se houver uma conta com <strong className="break-all font-semibold">{email}</strong>, um
          código de 6 dígitos chegou nesse e-mail. Ele vale {VALIDADE_CODIGO_MINUTOS} minutos.
          Confira também a caixa de spam.
        </p>
      </div>

      {errors.root && (
        <Alert tom="erro" titulo="Não foi possível redefinir a senha">
          {errors.root.message}
          <span className="mt-1 block text-texto-suave">
            Confira os dígitos ou peça um novo código abaixo. Depois de {MAX_TENTATIVAS_CODIGO}{' '}
            tentativas erradas o código deixa de valer.
          </span>
        </Alert>
      )}

      <Input
        label="Código recebido"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={9}
        placeholder="000000"
        obrigatorio
        className="[&_input]:font-mono [&_input]:tracking-[0.3em]"
        erro={errors.codigo?.message}
        {...register('codigo')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSenha
          label="Nova senha"
          autoComplete="new-password"
          obrigatorio
          ajuda="De 8 a 128 caracteres."
          erro={errors.novaSenha?.message}
          {...register('novaSenha')}
        />
        <CampoSenha
          label="Confirmar nova senha"
          autoComplete="new-password"
          obrigatorio
          erro={errors.confirmacao?.message}
          {...register('confirmacao')}
        />
      </div>

      <Button type="submit" carregando={enviando} tamanho="lg" className="w-full">
        {enviando ? 'Redefinindo…' : 'Redefinir senha'}
      </Button>

      <div className="flex flex-col items-start gap-1 border-t border-borda pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Button
          variante="link"
          tamanho="sm"
          className="h-auto px-0"
          carregando={reenviar.isPending}
          onClick={() => reenviar.mutate()}
        >
          Não chegou? Enviar outro código
        </Button>
        <Button variante="link" tamanho="sm" className="h-auto px-0" onClick={aoTrocarEmail}>
          Usar outro e-mail
        </Button>
      </div>
    </form>
  );
}

function Concluido() {
  return (
    <div className="space-y-4" role="status">
      <CheckCircle2 className="h-8 w-8 text-sucesso" aria-hidden />
      <Cabecalho
        titulo="Senha redefinida"
        descricao="Sua senha foi trocada. Use a nova senha da próxima vez que entrar."
      />
      <Link href={rotas.login} className={classesBotao('primaria', 'lg', 'w-full')}>
        Ir para o login
      </Link>
    </div>
  );
}

function Cabecalho({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="space-y-1.5">
      <h1 className="font-titulo text-titulo-pagina text-texto">{titulo}</h1>
      {descricao && <p className="text-sm text-texto-suave">{descricao}</p>}
    </div>
  );
}

function VoltarAoLogin() {
  return (
    <Link
      href={rotas.login}
      className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primaria hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Voltar para o login
    </Link>
  );
}
