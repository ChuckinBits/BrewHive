// Settings, backup and what is coming next.

import { useRef, useState } from 'react';
import { createBackup, downloadBackup, restoreBackup } from '../db/backup.ts';
import { clearAll } from '../db/idb.ts';
import { loadSampleData } from '../db/sample.ts';
import { currencyOf, ensureStarterIngredients, rememberTheme, saveSettings, useSettings } from '../db/store.ts';
import { CURRENCIES } from '../lib/cost.ts';
import { ConfirmSheet, Segmented, TopBar, toast } from '../components/ui.tsx';
import { Icon, type IconName } from '../icons/Icon.tsx';
import { isDemo } from '../lib/demo.ts';
import { plural } from '../lib/format.ts';
import { APP_VERSION, REPO_URL } from '../lib/version.ts';
import { Link } from '../lib/router.tsx';

const ROADMAP: { icon: IconName; title: string; text: string }[] = [
  { icon: 'honey', title: 'Ingredient library', text: 'Your ingredients by category, with costs and batch totals. Planned for v0.2.' },
  { icon: 'rack', title: 'Equipment and inventory', text: 'Vessels and ingredient stock. Planned for v0.3.' },
  { icon: 'sparkle', title: 'Calculators and reminders', text: 'ABV, backsweetening and nutrient schedules. Planned for v0.3.' },
  { icon: 'upload', title: 'Sync between devices', text: 'Through a server you host yourself. Planned for v0.5.' },
  { icon: 'people', title: 'Community recipes', text: 'Share, rate and tip recipes over Nostr. Planned for v0.6.' },
];

export function MoreScreen() {
  const settings = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  const [erasing, setErasing] = useState(false);

  const exportBackup = async () => {
    // Hosted previews cannot save files to the device.
    if (isDemo()) return toast('Backups are switched off in this preview');
    try {
      downloadBackup(await createBackup());
      toast('Backup saved to your downloads');
    } catch (error) {
      console.error(error);
      toast('The backup could not be saved');
    }
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      const written = await restoreBackup(JSON.parse(await file.text()));
      toast(`Backup restored: ${plural(written, 'record')}`);
    } catch (error) {
      toast(error instanceof SyntaxError ? 'That file is not a BrewHive backup.' : error instanceof Error ? error.message : 'The backup could not be read.');
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <>
      <TopBar title="More" />

      <Link to="/ingredients" className="card more-link">
        <span className="timeline-icon">
          <Icon name="honey" size={20} />
        </span>
        <span className="more-link-text">
          <strong>Ingredients</strong>
          <span className="muted">Your ingredient library: categories, default units and costs.</span>
        </span>
        <Icon name="chevron" size={18} />
      </Link>

      <section className="card">
        <h2>Units</h2>
        <div className="settings-row">
          <span>Volume</span>
          <Segmented
            label="Volume unit"
            value={settings.volumeUnit}
            onChange={(volumeUnit) => saveSettings({ volumeUnit })}
            options={[
              { id: 'gal', label: 'Gallons' },
              { id: 'L', label: 'Liters' },
            ]}
          />
        </div>
        <div className="settings-row">
          <span>Temperature</span>
          <Segmented
            label="Temperature unit"
            value={settings.tempUnit}
            onChange={(tempUnit) => saveSettings({ tempUnit })}
            options={[
              { id: 'F', label: '°F' },
              { id: 'C', label: '°C' },
            ]}
          />
        </div>
        <div className="settings-row">
          <span>Currency</span>
          <select className="settings-select" aria-label="Currency" value={currencyOf(settings)} onChange={(e) => saveSettings({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card">
        <h2>Appearance</h2>
        <div className="settings-row">
          <span>Theme</span>
          <Segmented
            label="Theme"
            value={settings.theme}
            onChange={(theme) => saveSettings({ theme })}
            options={[
              { id: 'system', label: 'Auto' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted">Everything is stored on this device only. Nothing is sent anywhere. Save a backup now and then, especially before clearing your browser data.</p>
        <button type="button" className="btn" onClick={exportBackup}>
          <Icon name="download" size={20} />
          Save a backup file
        </button>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          <Icon name="upload" size={20} />
          Restore from a backup file
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-label="Backup file" onChange={(e) => importBackup(e.target.files?.[0])} />
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await loadSampleData();
            toast('Sample data added');
          }}
        >
          <Icon name="sparkle" size={20} />
          Add sample data
        </button>
        <button type="button" className="btn btn-danger-quiet" onClick={() => setErasing(true)}>
          <Icon name="trash" size={20} />
          Erase everything
        </button>
      </section>

      <section className="card">
        <h2>Coming next</h2>
        <ul className="roadmap">
          {ROADMAP.map((item) => (
            <li key={item.title}>
              <span className="timeline-icon">
                <Icon name={item.icon} size={20} />
              </span>
              <span>
                <strong>{item.title}</strong>
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="about">
        <strong>BrewHive</strong>
        From first pitch to final gravity
        <br />
        Version {APP_VERSION} · Open source under the MIT license · <a href={REPO_URL}>Source code</a>
      </footer>

      {erasing && (
        <ConfirmSheet
          title="Erase everything?"
          message="Every recipe, batch, bottle, ingredient and setting on this device will be deleted, and the starter ingredients put back. This cannot be undone, so save a backup first if you might want it back."
          confirmLabel="Erase everything"
          onClose={() => setErasing(false)}
          onConfirm={async () => {
            await clearAll();
            // Like a fresh install, which starts with the starter ingredients.
            await ensureStarterIngredients();
            rememberTheme('system');
            setErasing(false);
            toast('Everything was erased');
          }}
        />
      )}
    </>
  );
}
