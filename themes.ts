// Theme System for FinSnap
// Defines multiple UI themes that can be switched on-the-fly

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    // Base colors
    background: string;
    foreground: string;
    primary: string;
    primaryDark: string;
    secondary: string;
    secondaryDark: string;
    accent: string;
    accentAlt: string;

    // Semantic colors
    income: string;
    expense: string;
    success: string;
    error: string;
    warning: string;

    // Neutrals
    black: string;
    white: string;
    gray: string;
    grayLight: string;
    grayDark: string;
  };
  typography: {
    fontDisplay: string;
    fontMono: string;
    fontBody: string;
  };
  spacing: {
    borderWidth: string;
    borderRadius: string;
  };
  effects: {
    shadowSm: string;
    shadowMd: string;
    shadowLg: string;
    shadowXl: string;
  };
}

// Neo-Brutalist Theme (Current Bold Design)
export const neoBrutalistTheme: Theme = {
  id: 'neo-brutalist',
  name: 'Neo-Brutalist',
  description: 'Bold, high-contrast design with electric accents',
  colors: {
    background: '#FFFFFF',
    foreground: '#000000',
    primary: '#BFFF00',
    primaryDark: '#9FD000',
    secondary: '#FF006E',
    secondaryDark: '#CC0058',
    accent: '#00F5FF',
    accentAlt: '#FFD600',
    income: '#BFFF00',
    expense: '#FF006E',
    success: '#BFFF00',
    error: '#FF006E',
    warning: '#FFD600',
    black: '#000000',
    white: '#FFFFFF',
    gray: '#808080',
    grayLight: '#F5F5F5',
    grayDark: '#1A1A1A',
  },
  typography: {
    fontDisplay: "'Outfit', sans-serif",
    fontMono: "'JetBrains Mono', monospace",
    fontBody: "'DM Sans', sans-serif",
  },
  spacing: {
    borderWidth: '3px',
    borderRadius: '2px',
  },
  effects: {
    shadowSm: '2px 2px 0 #000',
    shadowMd: '4px 4px 0 #000',
    shadowLg: '6px 6px 0 #000',
    shadowXl: '8px 8px 0 #000',
  },
};

// Original Theme (Classic FinSnap Design)
export const originalTheme: Theme = {
  id: 'original',
  name: 'Original',
  description: 'Clean, modern fintech aesthetic',
  colors: {
    background: '#f8fafc',
    foreground: '#1e293b',
    primary: '#0d9488',
    primaryDark: '#0f766e',
    secondary: '#14b8a6',
    secondaryDark: '#0d9488',
    accent: '#06b6d4',
    accentAlt: '#8b5cf6',
    income: '#10b981',
    expense: '#ef4444',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    black: '#1e293b',
    white: '#ffffff',
    gray: '#64748b',
    grayLight: '#f1f5f9',
    grayDark: '#334155',
  },
  typography: {
    fontDisplay: "'Inter', system-ui, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
    fontBody: "'Inter', system-ui, sans-serif",
  },
  spacing: {
    borderWidth: '1px',
    borderRadius: '12px',
  },
  effects: {
    shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    shadowXl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Dark Mode Theme
export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark Mode',
  description: 'Easy on the eyes with OLED-friendly colors',
  colors: {
    background: '#0a0a0a',
    foreground: '#ffffff',
    primary: '#a3e635',
    primaryDark: '#84cc16',
    secondary: '#f472b6',
    secondaryDark: '#ec4899',
    accent: '#22d3ee',
    accentAlt: '#fbbf24',
    income: '#a3e635',
    expense: '#f87171',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#fbbf24',
    black: '#ffffff',
    white: '#0a0a0a',
    gray: '#a1a1aa',
    grayLight: '#27272a',
    grayDark: '#d4d4d8',
  },
  typography: {
    fontDisplay: "'Outfit', sans-serif",
    fontMono: "'JetBrains Mono', monospace",
    fontBody: "'DM Sans', sans-serif",
  },
  spacing: {
    borderWidth: '2px',
    borderRadius: '8px',
  },
  effects: {
    shadowSm: '0 0 10px rgba(163, 230, 53, 0.3)',
    shadowMd: '0 0 20px rgba(163, 230, 53, 0.4)',
    shadowLg: '0 0 30px rgba(163, 230, 53, 0.5)',
    shadowXl: '0 0 40px rgba(163, 230, 53, 0.6)',
  },
};

// Pastel Theme
export const pastelTheme: Theme = {
  id: 'pastel',
  name: 'Soft Pastel',
  description: 'Gentle colors for a calm experience',
  colors: {
    background: '#fef3f2',
    foreground: '#4a5568',
    primary: '#a7c7e7',
    primaryDark: '#8fb3d9',
    secondary: '#ffb3ba',
    secondaryDark: '#ff9aa2',
    accent: '#bae1ff',
    accentAlt: '#ffffba',
    income: '#b8e6b8',
    expense: '#ffcccb',
    success: '#b8e6b8',
    error: '#ffcccb',
    warning: '#ffe4b3',
    black: '#4a5568',
    white: '#ffffff',
    gray: '#a0aec0',
    grayLight: '#f7fafc',
    grayDark: '#718096',
  },
  typography: {
    fontDisplay: "'Quicksand', sans-serif",
    fontMono: "'Courier Prime', monospace",
    fontBody: "'Nunito', sans-serif",
  },
  spacing: {
    borderWidth: '2px',
    borderRadius: '16px',
  },
  effects: {
    shadowSm: '0 2px 4px rgba(0, 0, 0, 0.08)',
    shadowMd: '0 4px 8px rgba(0, 0, 0, 0.12)',
    shadowLg: '0 8px 16px rgba(0, 0, 0, 0.16)',
    shadowXl: '0 12px 24px rgba(0, 0, 0, 0.2)',
  },
};

// Cyberpunk Theme
export const cyberpunkTheme: Theme = {
  id: 'cyberpunk',
  name: 'Cyberpunk',
  description: 'Neon lights and futuristic vibes',
  colors: {
    background: '#0d0221',
    foreground: '#00ff9f',
    primary: '#00ff9f',
    primaryDark: '#00d684',
    secondary: '#ff006e',
    secondaryDark: '#d6005a',
    accent: '#00f5ff',
    accentAlt: '#ff00ff',
    income: '#00ff9f',
    expense: '#ff006e',
    success: '#00ff9f',
    error: '#ff006e',
    warning: '#ffea00',
    black: '#00ff9f',
    white: '#0d0221',
    gray: '#8a2be2',
    grayLight: '#1a0b2e',
    grayDark: '#c792ea',
  },
  typography: {
    fontDisplay: "'Orbitron', sans-serif",
    fontMono: "'Share Tech Mono', monospace",
    fontBody: "'Rajdhani', sans-serif",
  },
  spacing: {
    borderWidth: '2px',
    borderRadius: '4px',
  },
  effects: {
    shadowSm: '0 0 5px #00ff9f',
    shadowMd: '0 0 10px #00ff9f',
    shadowLg: '0 0 20px #00ff9f',
    shadowXl: '0 0 30px #00ff9f, 0 0 60px #ff006e',
  },
};

// All available themes
export const themes: Theme[] = [
  neoBrutalistTheme,
  originalTheme,
  darkTheme,
  pastelTheme,
  cyberpunkTheme,
];

// Helper function to apply theme to document
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  // Apply colors
  root.style.setProperty('--color-background', theme.colors.background);
  root.style.setProperty('--color-foreground', theme.colors.foreground);
  root.style.setProperty('--color-primary', theme.colors.primary);
  root.style.setProperty('--color-primary-dark', theme.colors.primaryDark);
  root.style.setProperty('--color-secondary', theme.colors.secondary);
  root.style.setProperty('--color-secondary-dark', theme.colors.secondaryDark);
  root.style.setProperty('--color-accent', theme.colors.accent);
  root.style.setProperty('--color-accent-alt', theme.colors.accentAlt);
  root.style.setProperty('--color-income', theme.colors.income);
  root.style.setProperty('--color-expense', theme.colors.expense);
  root.style.setProperty('--color-success', theme.colors.success);
  root.style.setProperty('--color-error', theme.colors.error);
  root.style.setProperty('--color-warning', theme.colors.warning);
  root.style.setProperty('--color-black', theme.colors.black);
  root.style.setProperty('--color-white', theme.colors.white);
  root.style.setProperty('--color-gray', theme.colors.gray);
  root.style.setProperty('--color-gray-light', theme.colors.grayLight);
  root.style.setProperty('--color-gray-dark', theme.colors.grayDark);

  // Apply typography
  root.style.setProperty('--font-display', theme.typography.fontDisplay);
  root.style.setProperty('--font-mono', theme.typography.fontMono);
  root.style.setProperty('--font-body', theme.typography.fontBody);

  // Apply spacing
  root.style.setProperty('--border-width', theme.spacing.borderWidth);
  root.style.setProperty('--border-radius', theme.spacing.borderRadius);

  // Apply effects
  root.style.setProperty('--shadow-sm', theme.effects.shadowSm);
  root.style.setProperty('--shadow-md', theme.effects.shadowMd);
  root.style.setProperty('--shadow-lg', theme.effects.shadowLg);
  root.style.setProperty('--shadow-xl', theme.effects.shadowXl);

  // Update background color
  document.body.style.backgroundColor = theme.colors.background;
  document.body.style.color = theme.colors.foreground;
  document.body.style.fontFamily = theme.typography.fontBody;

  // Store theme preference
  localStorage.setItem('finsnap-theme', theme.id);
}

// Get theme by ID
export function getThemeById(id: string): Theme {
  return themes.find(t => t.id === id) || neoBrutalistTheme;
}

// Get saved theme from localStorage
export function getSavedTheme(): Theme {
  const savedId = localStorage.getItem('finsnap-theme');
  return savedId ? getThemeById(savedId) : neoBrutalistTheme;
}
