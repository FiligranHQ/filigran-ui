import type { ChatPanelTheme } from '../types';

/** Each theme entry and the variable it sets (`assets/index.css` reads them). */
const THEME_VARIABLES: Readonly<Record<keyof ChatPanelTheme, string>> = {
  surface: '--filigran-chat-surface',
  surfaceRaised: '--filigran-chat-surface-raised',
  headerBackground: '--filigran-chat-header-background',
  text: '--filigran-chat-text',
  textMuted: '--filigran-chat-text-muted',
  border: '--filigran-chat-border',
  textSize: '--filigran-chat-text-size',
  userBackground: '--filigran-chat-user-background',
  userText: '--filigran-chat-user-text',
  userRadius: '--filigran-chat-user-radius',
  userPadding: '--filigran-chat-user-padding',
  userTextSize: '--filigran-chat-user-text-size',
  fontMono: '--filigran-chat-font-mono',
  codeSize: '--filigran-chat-code-size',
  codeSurface: '--filigran-chat-code-surface',
};

/** The variables *theme* sets on the panel root: only those it gives a value. */
export function themeVariables(theme: ChatPanelTheme | undefined): Record<string, string> {
  const variables: Record<string, string> = {};
  if (!theme) return variables;
  for (const [key, variable] of Object.entries(THEME_VARIABLES) as [keyof ChatPanelTheme, string][]) {
    const value = theme[key];
    if (typeof value === 'string' && value.trim()) variables[variable] = value;
  }
  return variables;
}
