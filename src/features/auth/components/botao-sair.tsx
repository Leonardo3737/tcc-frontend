'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';

import { sair } from '../api/auth.service';
import { DropdownItem } from '@/components/ui/dropdown';
import { rotas } from '@/config/rotas';
import { toast } from '@/components/ui/toast';

/**
 * Logout.
 *
 * `queryClient.clear()` nao e detalhe: sem ele, o cache do TanStack Query
 * sobrevive a troca de usuario e o proximo login exibiria, por um instante,
 * dados da pessoa anterior antes do refetch.
 *
 * O item nao fecha o menu sozinho (`onSelect` com preventDefault) para que o
 * usuario veja o estado de saida em vez de o menu piscar e nada acontecer.
 */
export function BotaoSair() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saindo, setSaindo] = useState(false);

  async function executarSaida() {
    if (saindo) return;
    setSaindo(true);

    try {
      await sair();
    } catch {
      // Falhar aqui nao pode prender o usuario logado: mesmo sem confirmacao do
      // servidor, seguimos para o login. O cookie e httpOnly e o navegador o
      // descarta na expiracao; o pior caso e uma sessao que ainda existe no
      // dispositivo, que o proximo acesso resolve.
      toast.erro('Não foi possível encerrar a sessão no servidor.');
    } finally {
      queryClient.clear();
      router.replace(rotas.login);
      router.refresh();
    }
  }

  return (
    <DropdownItem
      destrutivo
      disabled={saindo}
      onSelect={(evento) => {
        evento.preventDefault();
        void executarSaida();
      }}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {saindo ? 'Saindo…' : 'Sair'}
    </DropdownItem>
  );
}
