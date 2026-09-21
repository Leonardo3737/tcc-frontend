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
  cadastroAluno: '/cadastro/aluno',
  cadastroProfessor: '/cadastro/professor',

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
  ranking: '/ranking',
  conta: '/conta',

  // Internas (BFF)
  bffLogin: '/api/bff/login',
  bffLogout: '/api/bff/logout',
} as const;

/** Prefixos que o middleware trata como area publica. */
export const PREFIXOS_PUBLICOS = ['/login', '/cadastro'] as const;
