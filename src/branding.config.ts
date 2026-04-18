export const brandingConfig = {
  appName: "Spartified",
  logo: "/omobio_logo.png",
  logoSmall: "/globe.svg",
  favicon: "/favicon.ico",
  showThemeToggle: true, // Configurable button for Dark and Light mode
  // `theme` is a getter — always reads the current live theme
  get theme() {
    return currentThemeTokens;
  }
};

// ─── Theme Tokens ─────────────────────────────────────────────────────────────

export interface ThemeTokens {
  primaryColor: string;
  secondaryColor: string;
  background: string;
  componentBg: string;
  sidebarBg: string;
  sidebarText: string;
  textColor: string;
}

export const DARK_THEME: ThemeTokens = {
  primaryColor: "#3C83F6",
  secondaryColor: "#22D3EE",
  background: "#000000",
  componentBg: "#111827",
  sidebarBg: "#0F1729",
  sidebarText: "#F8FAFC",
  textColor: "#F8FAFC",
};

export const LIGHT_THEME: ThemeTokens = {
  primaryColor: "#3C83F6",
  secondaryColor: "#0891B2",
  background: "#F1F5F9",
  componentBg: "#FFFFFF",
  sidebarBg: "#1E3A5F",
  sidebarText: "#F8FAFC",
  textColor: "#0F172A",
};

// Module-level mutable reference — updated by ThemeContext on every toggle
let currentThemeTokens: ThemeTokens = DARK_THEME;

/** Called by ThemeContext whenever the user toggles the theme. */
export function setActiveTheme(tokens: ThemeTokens) {
  currentThemeTokens = tokens;
}
