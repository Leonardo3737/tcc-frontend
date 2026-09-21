'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExternalLink, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardConteudo } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/campo';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonLista } from '@/components/ui/skeleton';
import { Paginacao } from '@/components/comum/paginacao';
import { DialogoConfirmacao, useConfirmacao } from '@/components/comum/confirmacao';
import { toast } from '@/components/ui/toast';
import {
  atualizarMaterial,
  listarMateriais,
  publicarMaterial,
  removerMaterial,
} from '../api/materiais.service';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { useSessao } from '@/providers/sessao-provider';
import { podeEditarMaterial } from '@/lib/autorizacao/capacidades';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { mensagemDeErro } from '@/lib/api/erros';
import { chaves } from '@/lib/query/chaves';
import { formatarDataHora } from '@/lib/datas/fuso';
import type { Material } from '@/types/dominio';

/**
 * Acervo da monitoria (RN07: so participantes acessam; RN08: publicam professor
 * responsavel e MONITOR).
 *
 * O material e sempre um LINK — o backend nao implementa upload. A UI declara
 * essa limitacao em vez de simular um recurso inexistente.
 */
export function PainelMateriais() {
  const { monitoria, capacidades, contexto } = useContextoMonitoria();
  const { usuario, fuso } = useSessao();
  const queryClient = useQueryClient();

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Material | undefined>();
  const [incluirRemovidos, setIncluirRemovidos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const confirmacaoRemocao = useConfirmacao<Material>();

  const filtro = { incluirRemovidos, pagina, limite: 20 };

  const consulta = useQuery({
    queryKey: chaves.monitorias.materiais(monitoria.id, filtro),
    queryFn: () => listarMateriais(monitoria.id, filtro),
  });

  const remover = useMutation({
    mutationFn: (materialId: string) => removerMaterial(monitoria.id, materialId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaves.monitorias.escopo(monitoria.id) });
      toast.sucesso('Material removido', 'O registro permanece no histórico (RN10).');
      confirmacaoRemocao.fechar();
    },
    onError: (erro) => toast.erro('Não foi possível remover', mensagemDeErro(erro)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-texto-suave">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-borda text-primaria"
            checked={incluirRemovidos}
            onChange={(evento) => {
              setIncluirRemovidos(evento.target.checked);
              setPagina(1);
            }}
          />
          Mostrar materiais removidos
        </label>

        {capacidades.publicarMaterial && (
          <Button
            onClick={() => {
              setEmEdicao(undefined);
              setDialogoAberto(true);
            }}
            iconeEsquerda={<Plus className="h-4 w-4" aria-hidden />}
          >
            Publicar material
          </Button>
        )}
      </div>

      {consulta.isPending && <SkeletonLista itens={3} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<FolderOpen className="h-8 w-8" aria-hidden />}
          titulo="Acervo vazio"
          descricao={
            capacidades.publicarMaterial
              ? 'Publique links de listas, slides e materiais de apoio para os monitorados.'
              : 'Os monitores e o professor ainda não publicaram materiais aqui.'
          }
          acao={
            capacidades.publicarMaterial && (
              <Button
                onClick={() => {
                  setEmEdicao(undefined);
                  setDialogoAberto(true);
                }}
                iconeEsquerda={<Plus className="h-4 w-4" aria-hidden />}
              >
                Publicar material
              </Button>
            )
          }
        />
      )}

      {consulta.isSuccess && consulta.data.dados.length > 0 && (
        <Card>
          <ul className="divide-y divide-borda">
            {consulta.data.dados.map((material) => {
              const removido = Boolean(material.removidoEm);
              const podeEditar = podeEditarMaterial(material, usuario, contexto);

              return (
                <li key={material.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-texto">{material.titulo}</h3>
                      {removido && <Badge tom="neutro">Removido</Badge>}
                    </div>

                    {material.descricao && (
                      <p className="text-sm text-texto-suave">{material.descricao}</p>
                    )}

                    <p className="text-xs text-texto-suave">
                      {material.autorNome ?? 'Autor'} ·{' '}
                      {formatarDataHora(material.publicadoEm, fuso)}
                    </p>

                    {material.url && !removido && (
                      /*
                        `rel="noopener noreferrer"` é obrigatório aqui: o link é
                        conteúdo enviado por outro usuário. Sem ele, a página de
                        destino ganharia acesso a `window.opener`.
                      */
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 break-all text-sm text-primaria hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {material.url}
                      </a>
                    )}
                  </div>

                  {podeEditar && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variante="secundaria"
                        tamanho="sm"
                        onClick={() => {
                          setEmEdicao(material);
                          setDialogoAberto(true);
                        }}
                        iconeEsquerda={<Pencil className="h-3.5 w-3.5" aria-hidden />}
                      >
                        Editar
                      </Button>

                      <Button
                        variante="fantasma"
                        tamanho="sm"
                        onClick={() => confirmacaoRemocao.pedirConfirmacao(material)}
                        iconeEsquerda={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <CardConteudo className="pt-0">
            <Paginacao
              meta={consulta.data.meta}
              aoMudarPagina={setPagina}
              desabilitado={consulta.isFetching}
            />
          </CardConteudo>
        </Card>
      )}

      <DialogoConfirmacao
        aberto={confirmacaoRemocao.aberto}
        aoFechar={confirmacaoRemocao.fechar}
        aoConfirmar={() => remover.mutate(confirmacaoRemocao.alvo!.id)}
        carregando={remover.isPending}
        titulo="Remover material"
        descricao={`“${confirmacaoRemocao.alvo?.titulo ?? ''}” sairá do acervo.`}
        rotuloConfirmar="Remover"
        aviso="O registro não é apagado (RN10): ele continua consultável em “mostrar materiais removidos”, com a data e o autor da remoção."
      />

      <DialogoMaterial
        aberto={dialogoAberto}
        aoFechar={() => setDialogoAberto(false)}
        monitoriaId={monitoria.id}
        material={emEdicao}
      />
    </div>
  );
}

/** Espelha criar-material.dto.ts / atualizar-material.dto.ts. */
const esquema = z.object({
  titulo: z
    .string()
    .trim()
    .min(3, 'O título deve ter ao menos 3 caracteres')
    .max(150, 'O título deve ter no máximo 150 caracteres'),
  descricao: z.string().trim().max(2000, 'Máximo de 2000 caracteres').optional(),
  url: z
    .string()
    .trim()
    .url('Informe um endereço válido')
    // Mesma restrição do backend: um `javascript:` publicado aqui viraria XSS.
    .refine((valor) => /^https?:\/\//i.test(valor), 'O endereço deve começar com http:// ou https://')
    .refine((valor) => valor.length <= 2048, 'Máximo de 2048 caracteres'),
});

type DadosMaterialForm = z.infer<typeof esquema>;

function DialogoMaterial({
  aberto,
  aoFechar,
  monitoriaId,
  material,
}: {
  aberto: boolean;
  aoFechar: () => void;
  monitoriaId: string;
  material?: Material;
}) {
  const queryClient = useQueryClient();
  const editando = Boolean(material);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosMaterialForm>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: {
      titulo: material?.titulo ?? '',
      descricao: material?.descricao ?? '',
      url: material?.url ?? '',
    },
  });

  const mutacao = useMutation({
    mutationFn: (dados: DadosMaterialForm) =>
      editando
        ? atualizarMaterial(monitoriaId, material!.id, dados)
        : publicarMaterial(monitoriaId, dados),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaves.monitorias.escopo(monitoriaId) });
      toast.sucesso(editando ? 'Material atualizado' : 'Material publicado');
      aoFechar();
    },

    onError: (erro) => aplicarErroDeFormulario(erro, setError, ['titulo', 'descricao', 'url']),
  });

  const enviando = isSubmitting || mutacao.isPending;

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      {aberto && (
        <DialogConteudo
          // key força o formulário a remontar ao trocar de material — sem isso,
          // abrir o segundo item mostraria os valores do primeiro.
          key={material?.id ?? 'novo'}
          titulo={editando ? 'Editar material' : 'Publicar material'}
          descricao="O material é um link. A plataforma não hospeda arquivos."
        >
          <form
            onSubmit={handleSubmit((dados) => mutacao.mutate(dados))}
            className="space-y-4"
            noValidate
          >
            {errors.root && <Alert tom="erro">{errors.root.message}</Alert>}

            <Input
              label="Título"
              obrigatorio
              autoFocus
              placeholder="Lista de exercícios — Limites"
              erro={errors.titulo?.message}
              {...register('titulo')}
            />

            <Input
              label="Endereço (URL)"
              type="url"
              obrigatorio
              placeholder="https://drive.exemplo.com/lista.pdf"
              ajuda="Apenas http:// ou https://"
              erro={errors.url?.message}
              {...register('url')}
            />

            <Textarea
              label="Descrição"
              rows={3}
              ajuda="Opcional."
              erro={errors.descricao?.message}
              {...register('descricao')}
            />

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variante="secundaria" onClick={aoFechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" carregando={enviando}>
                {enviando ? 'Salvando…' : editando ? 'Salvar' : 'Publicar'}
              </Button>
            </div>
          </form>
        </DialogConteudo>
      )}
    </Dialog>
  );
}
