/** Demo mode is switched on by hosted previews with <html data-demo="true">. It is off in the real app. */
export function isDemo(): boolean {
  return document.documentElement.dataset.demo === 'true';
}
