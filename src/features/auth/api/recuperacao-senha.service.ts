import { apiCliente } from '@/lib/api/cliente';

/**
 * Recuperacao de senha por codigo enviado ao e-mail.
 *
 * Duas rotas publicas, sem sessao (o proxy simplesmente nao anexa
 * Authorization quando nao ha cookie):
 *
 *  1. `solicitar` responde 202 SEMPRE — exista ou nao a conta. A tela nunca
 *     diz "e-mail nao encontrado": isso faria dela um enumerador de contas.
 *  2. `confirmar` responde 204, ou 400 com a MESMA mensagem para codigo
 *     errado, expirado, ja usado ou e-mail inexistente.
 *
 * Nao existe rota para "so validar o codigo" (seria um oraculo para testar
 * codigos), entao a tela pede codigo e nova senha juntos e guarda o e-mail em
 * memoria entre as etapas.
 */
export function solicitarRecuperacao(email: string): Promise<void> {
  return apiCliente.post<void>('/auth/recuperacao/solicitar', { email });
}

export function confirmarRecuperacao(dados: {
  email: string;
  codigo: string;
  novaSenha: string;
}): Promise<void> {
  return apiCliente.post<void>('/auth/recuperacao/confirmar', {
    email: dados.email,
    codigo: dados.codigo,
    novaSenha: dados.novaSenha,
  });
}
