/**
 * Query keys centralizadas.
 *
 * Hierarquicas de proposito: `['monitorias', id, 'participantes']` permite
 * invalidar tudo de uma monitoria com um prefixo, em vez de listar cada chave
 * afetada. Depois de habilitar um monitor, por exemplo, muda a lista de
 * participantes E o contexto da monitoria — um `invalidateQueries({ queryKey:
 * chaves.monitorias.detalhe(id) })` cobre os dois.
 *
 * Manter isto em um arquivo evita o erro classico de escrever a chave a mao com
 * uma letra diferente na invalidacao e passar horas atras de "o cache nao
 * atualiza".
 */
export const chaves = {
  configuracao: ['configuracao'] as const,

  sessao: ['sessao'] as const,

  usuarios: {
    raiz: ['usuarios'] as const,
    eu: ['usuarios', 'eu'] as const,
  },

  alunos: {
    raiz: ['alunos'] as const,
    lista: (filtro: Record<string, unknown>) => ['alunos', 'lista', filtro] as const,
    detalhe: (id: string) => ['alunos', id] as const,
  },

  professores: {
    raiz: ['professores'] as const,
    lista: (filtro: Record<string, unknown>) => ['professores', 'lista', filtro] as const,
  },

  cursos: {
    raiz: ['cursos'] as const,
    lista: (filtro: Record<string, unknown>) => ['cursos', 'lista', filtro] as const,
    detalhe: (id: string) => ['cursos', id] as const,
  },

  disciplinas: {
    raiz: ['disciplinas'] as const,
    lista: (filtro: Record<string, unknown>) => ['disciplinas', 'lista', filtro] as const,
    detalhe: (id: string) => ['disciplinas', id] as const,
  },

  monitorias: {
    raiz: ['monitorias'] as const,
    /**
     * Prefixo de TUDO que pertence a uma monitoria.
     *
     * Existe para que a invalidação depois de uma mutação não precise escrever
     * `['monitorias', id, 'participantes']` à mão em cada arquivo — repetir a
     * chave literal é como se perde a sincronia entre quem grava e quem
     * invalida, e o sintoma ("o cache não atualiza") é caro de diagnosticar.
     */
    escopo: (id: string) => ['monitorias', id] as const,
    lista: (filtro: Record<string, unknown>) => ['monitorias', 'lista', filtro] as const,
    minhas: (filtro: Record<string, unknown>) => ['monitorias', 'minhas', filtro] as const,
    detalhe: (id: string) => ['monitorias', id] as const,
    participantes: (id: string, filtro: Record<string, unknown>) =>
      ['monitorias', id, 'participantes', filtro] as const,
    disponibilidades: (id: string, filtro: Record<string, unknown>) =>
      ['monitorias', id, 'disponibilidades', filtro] as const,
    atendimentos: (id: string, filtro: Record<string, unknown>) =>
      ['monitorias', id, 'atendimentos', filtro] as const,
    /**
     * Fica sob o escopo da monitoria para ser invalidada junto com ela: depois
     * de agendar, os slots ocupados mudam, e uma chave fora do escopo
     * continuaria oferecendo o horário que acabou de ser tomado.
     */
    horariosLivres: (id: string, filtro: Record<string, unknown>) =>
      ['monitorias', id, 'horarios-livres', filtro] as const,
    materiais: (id: string, filtro: Record<string, unknown>) =>
      ['monitorias', id, 'materiais', filtro] as const,
    indicadores: (id: string) => ['monitorias', id, 'indicadores'] as const,
    desempenhoMonitores: (id: string) => ['monitorias', id, 'indicadores', 'monitores'] as const,
  },

  atendimentos: {
    raiz: ['atendimentos'] as const,
    meus: (filtro: Record<string, unknown>) => ['atendimentos', 'meus', filtro] as const,
    detalhe: (id: string) => ['atendimentos', id] as const,
    historico: (id: string) => ['atendimentos', id, 'historico'] as const,
    avaliacoes: (id: string) => ['atendimentos', id, 'avaliacoes'] as const,
  },

  gamificacao: {
    raiz: ['gamificacao'] as const,
    /** Tabela de pontos: muda só em deploy, então vive em cache longo. */
    regras: ['gamificacao', 'regras'] as const,
    ranking: (filtro: Record<string, unknown>) => ['gamificacao', 'ranking', filtro] as const,
    meusPontos: (filtro: Record<string, unknown>) =>
      ['gamificacao', 'meus-pontos', filtro] as const,
  },

  analytics: {
    raiz: ['analytics'] as const,
    resumo: (apenasMinhas: boolean) => ['analytics', 'resumo', apenasMinhas] as const,
  },
} as const;
