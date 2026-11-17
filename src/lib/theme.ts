// Applies the theme chosen in Settings by setting data-theme on <html>.
// "system" removes the attribute again, but only if BrewHive was the one that
// set it, so a host page that sets its own theme is left alone.

export function applyTheme(theme: 'system' | 'light' | 'dark'): void {
  const root = document.documentElement;
  if (theme === 'system') {
    if (root.dataset.themeBy === 'brewhive') {
      delete root.dataset.theme;
      delete root.dataset.themeBy;
    }
    return;
  }
  root.dataset.theme = theme;
  root.dataset.themeBy = 'brewhive';
}
