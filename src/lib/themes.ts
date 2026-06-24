export interface SystemTheme {
  id: string;
  name: string;
  color: string; // hex representation of primary-600 for preview
  variables: {
    '--primary-50': string;
    '--primary-100': string;
    '--primary-200': string;
    '--primary-300': string;
    '--primary-400': string;
    '--primary-500': string;
    '--primary-600': string;
    '--primary-700': string;
    '--primary-900': string;
  };
}

export const SYSTEM_THEMES: SystemTheme[] = [
  {
    id: 'azul',
    name: 'Azul Clássico',
    color: '#2563eb',
    variables: {
      '--primary-50': '#eff6ff',
      '--primary-100': '#dbeafe',
      '--primary-200': '#bfdbfe',
      '--primary-300': '#93c5fd',
      '--primary-400': '#60a5fa',
      '--primary-500': '#3b82f6',
      '--primary-600': '#2563eb',
      '--primary-700': '#1d4ed8',
      '--primary-900': '#1e3a8a',
    }
  },
  {
    id: 'verde',
    name: 'Verde Esmeralda',
    color: '#059669',
    variables: {
      '--primary-50': '#ecfdf5',
      '--primary-100': '#d1fae5',
      '--primary-200': '#a7f3d0',
      '--primary-300': '#6ee7b7',
      '--primary-400': '#34d399',
      '--primary-500': '#10b981',
      '--primary-600': '#059669',
      '--primary-700': '#047857',
      '--primary-900': '#064e3b',
    }
  },
  {
    id: 'roxo',
    name: 'Roxo Violeta',
    color: '#9333ea',
    variables: {
      '--primary-50': '#faf5ff',
      '--primary-100': '#f3e8ff',
      '--primary-200': '#e9d5ff',
      '--primary-300': '#d8b4fe',
      '--primary-400': '#c084fc',
      '--primary-500': '#a855f7',
      '--primary-600': '#9333ea',
      '--primary-700': '#7e22ce',
      '--primary-900': '#581c87',
    }
  },
  {
    id: 'laranja',
    name: 'Laranja Imperial',
    color: '#ea580c',
    variables: {
      '--primary-50': '#fff7ed',
      '--primary-100': '#ffedd5',
      '--primary-200': '#fed7aa',
      '--primary-300': '#fdbb2d',
      '--primary-400': '#fb923c',
      '--primary-500': '#f97316',
      '--primary-600': '#ea580c',
      '--primary-700': '#c2410c',
      '--primary-900': '#7c2d12',
    }
  },
  {
    id: 'vermelho',
    name: 'Vermelho Carmim',
    color: '#dc2626',
    variables: {
      '--primary-50': '#fef2f2',
      '--primary-100': '#fee2e2',
      '--primary-200': '#fecaca',
      '--primary-300': '#fca5a5',
      '--primary-400': '#f87171',
      '--primary-500': '#ef4444',
      '--primary-600': '#dc2626',
      '--primary-700': '#b91c1c',
      '--primary-900': '#7f1d1d',
    }
  },
  {
    id: 'rosa',
    name: 'Rosa Magenta',
    color: '#db2777',
    variables: {
      '--primary-50': '#fdf2f8',
      '--primary-100': '#fce7f3',
      '--primary-200': '#fbcfe8',
      '--primary-300': '#f9a8d4',
      '--primary-400': '#f472b6',
      '--primary-500': '#ec4899',
      '--primary-600': '#db2777',
      '--primary-700': '#be185d',
      '--primary-900': '#831843',
    }
  },
  {
    id: 'ciano',
    name: 'Turquesa Ciano',
    color: '#0891b2',
    variables: {
      '--primary-50': '#ecfeff',
      '--primary-100': '#cffafe',
      '--primary-200': '#a5f3fc',
      '--primary-300': '#67e8f9',
      '--primary-400': '#22d3ee',
      '--primary-500': '#06b6d4',
      '--primary-600': '#0891b2',
      '--primary-700': '#0e7490',
      '--primary-900': '#164e63',
    }
  },
  {
    id: 'amber',
    name: 'Dourado Âmbar',
    color: '#d97706',
    variables: {
      '--primary-50': '#fffbeb',
      '--primary-100': '#fef3c7',
      '--primary-200': '#fde68a',
      '--primary-300': '#fcd34d',
      '--primary-400': '#fbbf24',
      '--primary-500': '#f59e0b',
      '--primary-600': '#d97706',
      '--primary-700': '#b45309',
      '--primary-900': '#78350f',
    }
  }
];

export function applySystemTheme(themeId: string) {
  const selected = SYSTEM_THEMES.find(t => t.id === themeId) || SYSTEM_THEMES[0];
  const root = document.documentElement;
  Object.entries(selected.variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  localStorage.setItem('system_theme_colors', themeId);
}

export function getActiveSystemThemeId(): string {
  return localStorage.getItem('system_theme_colors') || 'azul';
}
