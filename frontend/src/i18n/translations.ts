// Dicionário de traduções — chaves organizadas por página/área para facilitar a migração
// incremental (ver LanguageContext.tsx). Cada chave existe em 'pt' e 'en'; t() cai para a
// própria chave se faltar uma tradução, nunca rebenta a UI por uma entrada em falta.
export const translations = {
  pt: {
    // Comum a várias páginas
    common: {
      loading: 'A carregar…',
      cancel: 'Cancelar',
      save: 'Guardar',
      saving: 'A guardar…',
      confirm: 'Confirmar',
      delete: 'Remover',
      edit: 'Editar',
      back: 'Voltar',
      close: 'Fechar',
      error: 'Erro',
      retry: 'Tentar novamente',
    },

    // AppLayout — sidebar e topbar
    appLayout: {
      applications: 'Aplicações',
      environments: 'Ambientes',
      approvals: 'Aprovações',
      team: 'Equipa',
      settings: 'Definições',
      howItWorks: 'Como funciona',
      logout: 'Terminar sessão',
      githubIdentity: 'Identidade GitHub',
      notConfigured: 'Ainda não configurada',
      openMenu: 'Abrir menu',
    },

    // Home / Resumo
    home: {
      title: 'Resumo',
      activeDeploys: 'Deploys ativos',
      healthy: 'Saudáveis',
      degraded: 'Degradados',
      needsAttention: 'Requer atenção',
      deploysToday: 'Deploys hoje',
      applicationsTitle: 'Aplicações',
      noApplications: 'Sem applications configuradas.',
      deploy: 'Deploy',
      viewApp: 'Ver app →',
      chooseTargetEnv: 'Escolhe o environment de destino',
      forEnv: 'para',
      checking: 'a verificar…',
      unknown: 'Desconhecido',
      projectNotFound: 'Projeto não encontrado. Faz onboarding primeiro.',
      alreadyDeployedTitle: 'Já está tudo deployado — sem commits novos desde o último deploy.',
    },
  },
  en: {
    common: {
      loading: 'Loading…',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving…',
      confirm: 'Confirm',
      delete: 'Remove',
      edit: 'Edit',
      back: 'Back',
      close: 'Close',
      error: 'Error',
      retry: 'Try again',
    },

    appLayout: {
      applications: 'Applications',
      environments: 'Environments',
      approvals: 'Approvals',
      team: 'Team',
      settings: 'Settings',
      howItWorks: 'How it works',
      logout: 'Log out',
      githubIdentity: 'GitHub identity',
      notConfigured: 'Not configured yet',
      openMenu: 'Open menu',
    },

    home: {
      title: 'Summary',
      activeDeploys: 'Active deploys',
      healthy: 'Healthy',
      degraded: 'Degraded',
      needsAttention: 'Needs attention',
      deploysToday: 'Deploys today',
      applicationsTitle: 'Applications',
      noApplications: 'No applications configured.',
      deploy: 'Deploy',
      viewApp: 'View app →',
      chooseTargetEnv: 'Choose the target environment',
      forEnv: 'to',
      checking: 'checking…',
      unknown: 'Unknown',
      projectNotFound: 'Project not found. Complete onboarding first.',
      alreadyDeployedTitle: 'Everything is already deployed — no new commits since the last deploy.',
    },
  },
} as const;

export type Language = keyof typeof translations;
export type TranslationKeys = typeof translations.pt;
