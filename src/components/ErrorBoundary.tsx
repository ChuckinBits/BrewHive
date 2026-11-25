// Catches a screen that fails to draw, so the app shows what went wrong
// instead of a blank page.

import { Component, type ReactNode } from 'react';
import { isDemo } from '../lib/demo.ts';
import { deleteDatabase } from '../db/idb.ts';

/** What the person sees when BrewHive can't go on: the reason, the error itself, and ways out. */
export function ProblemScreen({ title, message, error }: { title: string; message: string; error?: unknown }) {
  const detail = error instanceof Error ? error.message : error != null ? String(error) : '';
  return (
    <div className="app">
      <section className="card problem" role="alert">
        <h2>{title}</h2>
        <p>{message}</p>
        {detail && <p className="problem-detail">{detail}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={() => location.reload()}>
          Reload
        </button>
        {isDemo() && (
          // Only in a hosted preview: its data is sample data, so starting over loses nothing that matters.
          <button
            type="button"
            className="btn btn-block"
            onClick={async () => {
              await deleteDatabase();
              location.reload();
            }}
          >
            Start the preview over
          </button>
        )}
      </section>
    </div>
  );
}

/** Wraps the current screen; `resetKey` (the address) clears the error when you go somewhere else. */
export class ErrorBoundary extends Component<{ resetKey: string; children: ReactNode }, { error: unknown; key: string }> {
  state = { error: null as unknown, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: unknown; key: string }) {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.error != null) {
      return <ProblemScreen title="This screen couldn't be drawn" message="Something went wrong showing this screen. Your data is still on this device. Reload, or pick another tab below." error={this.state.error} />;
    }
    return this.props.children;
  }
}
