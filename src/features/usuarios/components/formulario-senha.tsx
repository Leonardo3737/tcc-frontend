'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { alterarSenha } from '../api/usuarios.service';
import { ApiError } from '@/lib/api/erros';
import { rotas } from '@/config/rotas';

/**
 * Espelha backend/src/modules/usuarios/dto/alterar-senha.dto.ts, mais a regra
 * "nova senha diferente da atual", que o service do backend tambem verifica.
 */
const esquema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a sua senha atual'),
    novaSenha: z
      .string()
      .min(8, 'A nova senha deve ter ao menos 8 caracteres')
      .max(128, 'A nova senha deve ter no máximo 128 caracteres'),
    confirmacao: z.string(),
  })
  .refine((dados) => dados.novaSenha === dados.confirmacao, {
    path: ['confirmacao'],
    message: 'As senhas não coincidem',
  })
  .refine((dados) => dados.senhaAtual !== dados.novaSenha, {
    path: ['novaSenha'],
    message: 'A nova senha deve ser diferente da atual',
  });

type DadosSenha = z.infer<typeof esquema>;

export function FormularioSenha() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosSenha>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: { senhaAtual: '', novaSenha: '', confirmacao: '' },
  });

  const mutacao = useMutation({
    mutationFn: (dados: DadosSenha) => alterarSenha(dados.senhaAtual, dados.novaSenha),

    onSuccess: () => {
      toast.sucesso('Senha alterada');
      reset();
    },

    onError: (erro: unknown) => {
      if (erro instanceof ApiError) {
        /**
         * O backend responde 401 quando a senha ATUAL esta incorreta. Aqui isso
         * nao significa sessao expirada — se caisse no tratamento global de 401,
         * o usuario seria deslogado por ter errado a propria senha. Por isso
         * marcamos o campo e encerramos.
         */
        if (erro.ehNaoAutenticado) {
          setError('senhaAtual', { type: 'server', message: 'Senha atual incorreta.' });
          return;
        }

        setError('root', { type: 'server', message: erro.message });
        return;
      }

      setError('root', { type: 'server', message: 'Não foi possível alterar a senha.' });
    },
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
        label="Senha atual"
        type="password"
        autoComplete="current-password"
        obrigatorio
        erro={errors.senhaAtual?.message}
        {...register('senhaAtual')}
      />

      {/*
        Trocar a senha aqui exige a atual. Quem nao lembra dela tem outro
        caminho: o codigo por e-mail, que nao depende da senha antiga.
      */}
      <p className="-mt-2 text-sm text-texto-suave">
        Não lembra a senha atual?{' '}
        <Link
          href={rotas.recuperarSenha}
          className="rounded font-semibold text-primaria hover:underline"
        >
          Redefinir por e-mail
        </Link>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          obrigatorio
          ajuda="Ao menos 8 caracteres."
          erro={errors.novaSenha?.message}
          {...register('novaSenha')}
        />

        <Input
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          obrigatorio
          erro={errors.confirmacao?.message}
          {...register('confirmacao')}
        />
      </div>

      <Button
        type="submit"
        carregando={enviando}
        iconeEsquerda={<KeyRound className="h-4 w-4" aria-hidden />}
      >
        {enviando ? 'Alterando…' : 'Alterar senha'}
      </Button>
    </form>
  );
}
