import * as fs from 'fs';

/**
 * Reconciles the live extension's auth state to the shared credential store
 * (~/.arcus/config.json + refresh.token). Because both this extension and the
 * Arcus CLI write that store, a sign-in or sign-out from *either* takes effect
 * in a running window immediately — not just on the next activation.
 *
 * Edge-triggered: it only fires onSignIn / onSignOut on a transition, so the
 * extension's own writes (which re-mirror the same state) are harmless no-ops.
 */
export interface ReconcileHooks {
  /** True when the live extension currently considers itself signed in. */
  isSignedIn: () => boolean;
  /** True when the shared store holds usable credentials (readSharedConfig() !== null). */
  hasSharedCreds: () => boolean;
  /** Adopt credentials that appeared in the shared store. */
  onSignIn: () => Promise<void> | void;
  /** Tear down the live session because credentials were removed. */
  onSignOut: () => Promise<void> | void;
}

export class SharedStoreWatcher {
  private watcher: fs.FSWatcher | undefined;
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private hooks: ReconcileHooks, private debounceMs = 150) {}

  /** Drive the live session to match the shared store; only acts on a transition. */
  async reconcile(): Promise<void> {
    const creds = this.hooks.hasSharedCreds();
    const live = this.hooks.isSignedIn();
    if (creds && !live) {
      await this.hooks.onSignIn();
    } else if (!creds && live) {
      await this.hooks.onSignOut();
    }
  }

  /** Begin watching `dir` (~/.arcus) and reconcile once for changes made while down. */
  start(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
    try {
      this.watcher = fs.watch(dir, (_event, filename) => {
        // Only credential files matter; ignore last_session.json, config (env), etc.
        if (filename && filename !== 'config.json' && filename !== 'refresh.token') return;
        this.schedule();
      });
    } catch {
      /* fs.watch unsupported here — initial reconcile below still runs */
    }
    void this.guarded();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; void this.guarded(); }, this.debounceMs);
  }

  /** Serialize reconciles so a burst of file writes can't overlap. */
  private async guarded(): Promise<void> {
    if (this.running) { this.schedule(); return; }
    this.running = true;
    try {
      await this.reconcile();
    } finally {
      this.running = false;
    }
  }

  stop(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    if (this.watcher) {
      try { this.watcher.close(); } catch { /* ignore */ }
      this.watcher = undefined;
    }
  }
}
