/**
 * Meridian studio entry (`?studio=meridian`). A separate boot path that never imports the
 * classic workbench (IdeApp), its eight global stylesheets or the Tailwind preflight, so the
 * studio's single token sheet owns every pixel it draws. It opens the same persisted working
 * session as the workbench through @redbyte/rb-apps/runtime.
 */
export async function bootstrapStudio(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) throw new Error('RedByte studio: #root element missing');
  document.documentElement.dataset.redbyteMode = 'studio';
  document.title = 'RedByte · Meridian Preview';
  const [{ createElement, StrictMode }, { createRoot }, { MeridianStudio }] = await Promise.all([
    import('react'),
    import('react-dom/client'),
    import('@redbyte/rb-studio'),
  ]);
  console.info('[RB_BOOT] mode=STUDIO entry=studio-bootstrap.ts');
  createRoot(root).render(createElement(StrictMode, null, createElement(MeridianStudio)));
}
