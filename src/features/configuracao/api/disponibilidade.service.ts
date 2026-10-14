import { apiCliente } from '@/lib/api/cliente';

/**
 * A API ja voltou a responder?
 *
 * Usada pela tela de "servidor ligando" para recarregar assim que possivel, em
 * vez de esperar o minuto inteiro. `GET /configuracao` e publica, leve e sem
 * efeito colateral — e cada chamada tambem ajuda a acordar o servidor.
 *
 * Timeout curto: enquanto a API acorda, a hospedagem pode segurar a conexao, e
 * a tela precisa continuar contando o tempo em vez de ficar presa na chamada.
 */
export async function servidorDisponivel(): Promise<boolean> {
  try {
    await apiCliente.get('/configuracao', { timeoutMs: 8_000, cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}
