// The app shell: picks the screen for the current address and draws the
// tab bar.

import { useEffect, useState, type ReactNode } from 'react';
import { batches, cellar, loadSettings, recipes, saveSettings, useSettings, ensureOgEntries, ensureStarterIngredients } from './db/store.ts';
import { loadSampleData } from './db/sample.ts';
import type { Settings } from './db/types.ts';
import { isDemo } from './lib/demo.ts';
import { applyTheme } from './lib/theme.ts';
import { Toaster } from './components/ui.tsx';
import { ErrorBoundary, ProblemScreen } from './components/ErrorBoundary.tsx';
import { withTimeout } from './db/idb.ts';
import { Icon, type IconName } from './icons/Icon.tsx';
import { Link, matchPath, useRoute } from './lib/router.tsx';
import { IngredientFormScreen, IngredientsScreen } from './screens/Ingredients.tsx';
import { BatchDetailScreen } from './screens/BatchDetail.tsx';
import { BatchFormScreen } from './screens/BatchForm.tsx';
import { BatchesScreen } from './screens/Batches.tsx';
import { CellarDetailScreen, CellarFormScreen, CellarScreen } from './screens/Cellar.tsx';
import { MoreScreen } from './screens/More.tsx';
import { EquipmentScreen } from './screens/Equipment.tsx';
import { RecipeDetailScreen, RecipeFormScreen, RecipesScreen } from './screens/Recipes.tsx';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Batches', icon: 'batches' },
  { to: '/recipes', label: 'Recipes', icon: 'recipes' },
  { to: '/cellar', label: 'Cellar', icon: 'cellar' },
  { to: '/more', label: 'More', icon: 'more' },
];

function activeTab(path: string): string {
  if (path.startsWith('/recipes')) return '/recipes';
  if (path.startsWith('/cellar')) return '/cellar';
  if (path.startsWith('/more') || path.startsWith('/ingredients') || path.startsWith('/equipment')) return '/more';
  return '/';
}

function pickScreen(path: string, query: URLSearchParams): ReactNode {
  let m: Record<string, string> | null;
  if (path === '/' || path === '/batches') return <BatchesScreen />;
  if (path === '/batches/new') return <BatchFormScreen recipeId={query.get('recipe') ?? undefined} />;
  if ((m = matchPath('/batches/:id/edit', path))) return <BatchFormScreen id={m.id} section={query.get('section') ?? undefined} />;
  if ((m = matchPath('/batches/:id', path))) return <BatchDetailScreen id={m.id} />;
  if (path === '/recipes') return <RecipesScreen />;
  if (path === '/recipes/new') return <RecipeFormScreen />;
  if ((m = matchPath('/recipes/:id/edit', path))) return <RecipeFormScreen id={m.id} />;
  if ((m = matchPath('/recipes/:id', path))) return <RecipeDetailScreen id={m.id} />;
  if (path === '/cellar') return <CellarScreen />;
  if (path === '/cellar/new') return <CellarFormScreen />;
  if ((m = matchPath('/cellar/:id/edit', path))) return <CellarFormScreen id={m.id} />;
  if ((m = matchPath('/cellar/:id', path))) return <CellarDetailScreen id={m.id} />;
  if (path === '/more') return <MoreScreen />;
  if (path === '/equipment') return <EquipmentScreen />;
  if (path === '/ingredients') return <IngredientsScreen />;
  if (path === '/ingredients/new') return <IngredientFormScreen category={query.get('category') ?? undefined} />;
  if ((m = matchPath('/ingredients/:id', path))) return <IngredientFormScreen id={m.id} />;
  return <BatchesScreen />;
}

/** In demo mode, a first visit starts with the sample data instead of an empty shelf. */
async function seedDemo(settings: Settings): Promise<void> {
  if (!isDemo() || settings.demoSeeded) return;
  const empty = (await batches.list()).length + (await recipes.list()).length + (await cellar.list()).length === 0;
  if (empty) await loadSampleData();
  await saveSettings({ demoSeeded: true });
}

let startup: Promise<void> | null = null;

export function App() {
  const { path, query } = useRoute();
  const settings = useSettings();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [problem, setProblem] = useState<unknown>(null);

  // Open the database once before drawing any screen.
  useEffect(() => {
    // The starter ingredients go in once per device (see ensureStarterIngredients).
    // Batches from before the OG had a timeline entry get one.
    // If storage never answers, say so after a while rather than staying blank.
    startup ??= withTimeout(loadSettings().then(seedDemo).then(ensureStarterIngredients).then(ensureOgEntries), 'opening BrewHive');
    startup.then(
      () => setState('ready'),
      (error) => {
        console.error(error);
        setProblem(error);
        setState('failed');
      },
    );
  }, []);

  useEffect(() => {
    if (state !== 'ready') return;
    applyTheme(settings.theme);
  }, [settings.theme, state]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  if (state === 'loading') return null;
  if (state === 'failed') {
    return (
      <ProblemScreen
        title="BrewHive couldn't open its data"
        message="BrewHive keeps everything in this browser's storage, and the browser didn't let it in. Another BrewHive tab or window can hold on to it, even one paused in the background: close the others and reload, or quit the browser completely and open BrewHive again. Private browsing windows often block storage too, so use a normal window."
        error={problem}
      />
    );
  }

  const isForm = path.endsWith('/new') || path.endsWith('/edit');
  const current = activeTab(path);

  return (
    <>
      <main className={isForm ? 'app app-no-tabs' : 'app'}>
        {isDemo() && path === '/' && <p className="demo-note">Preview with sample data. What you add stays in this browser only.</p>}
        <ErrorBoundary resetKey={path}>{pickScreen(path, query)}</ErrorBoundary>
      </main>
      {!isForm && (
        <nav className="tabbar" aria-label="Main">
          <div className="tabbar-inner">
            {TABS.map((tab) => (
              <Link key={tab.to} to={tab.to} className={tab.to === current ? 'tab tab-on' : 'tab'} aria-current={tab.to === current ? 'page' : undefined}>
                <span className="tab-pill">
                  <Icon name={tab.icon} />
                </span>
                {tab.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
      <Toaster />
    </>
  );
}
