/**
 * Rotas nomeadas.
 *
 * Existe para que uma URL nunca apareca escrita a mao no meio de um componente:
 * renomear um segmento passa a ser uma alteracao em um arquivo, e o TypeScript
 * aponta quem quebrou.
 */
export const rotas = {
  // Publicas
  login: '/login',
  recuperarSenha: '/recuperar-senha',

  // Autenticadas
  inicio: '/inicio',
  monitorias: '/monitorias',
  novaMonitoria: '/monitorias/nova',
  monitoria: (id: string) => `/monitorias/${id}`,
  monitoriaParticipantes: (id: string) => `/monitorias/${id}/participantes`,
  monitoriaDisponibilidades: (id: string) => `/monitorias/${id}/disponibilidades`,
  monitoriaAtendimentos: (id: string) => `/monitorias/${id}/atendimentos`,
  monitoriaAgendar: (id: string) => `/monitorias/${id}/atendimentos/agendar`,
  monitoriaMateriais: (id: string) => `/monitorias/${id}/materiais`,
  monitoriaIndicadores: (id: string) => `/monitorias/${id}/indicadores`,
  atendimentos: '/atendimentos',
  atendimento: (id: string) => `/atendimentos/${id}`,
  disciplinas: '/disciplinas',
  pessoas: '/pessoas',
  ranking: '/ranking',
  conta: '/conta',

  // Internas (BFF)
  bffLogin: '/api/bff/login',
  bffLogout: '/api/bff/logout',
} as const;

/**
 * Prefixos que o middleware trata como area publica (nao exigem sessao).
 *
 * Nao existe auto-cadastro: contas sao criadas por um professor autenticado
 * (POST /alunos e POST /professores), em Pessoas. A recuperacao de senha e
 * publica porque quem esqueceu a senha, por definicao, nao consegue entrar.
 */
export const PREFIXOS_PUBLICOS = ['/login', '/recuperar-senha'] as const;

/**
 * Publicas que nao fazem sentido para quem ja esta autenticado — o middleware
 * manda essa pessoa ao inicio. A recuperacao de senha fica de fora de proposito:
 * Minha conta aponta para ela, para quem nao lembra a senha atual.
 */
export const PREFIXOS_SO_SEM_SESSAO = ['/login'] as const;
