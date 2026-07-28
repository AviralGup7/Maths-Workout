// ─── Fault-injecting AsyncStorage simulator ──────────────────────────────────
// docs/23. Models the durability properties AsyncStorage actually gives you,
// and the ones it does NOT.
//
// Real behaviour being modelled:
//  · setItem for one key is atomic on both platforms (Android SQLite row,
//    iOS plist rewrite) — a single key is never left half-written
//  · there is NO transaction across keys: two setItem calls can be separated
//    by a crash, leaving key A new and key B old
//  · writes are asynchronous; a promise that has not resolved may never land
//  · the store can be full (SQLITE_FULL / NSFileWriteOutOfSpaceError) and
//    setItem then REJECTS
//
// The audit's job is to find places where the app assumes properties the
// platform does not provide.

export type Fault =
  | { kind: 'none' }
  /** Reject every write after the Nth. Models device-full. */
  | { kind: 'full'; afterWrites: number }
  /** Hard-kill the process after the Nth write: later writes never land. */
  | { kind: 'crash'; afterWrites: number }
  /** Corrupt the stored bytes for a key on write (truncation). */
  | { kind: 'truncate'; key: string };

export class FakeStorage {
  private data = new Map<string, string>();
  private writes = 0;
  private dead = false;
  fault: Fault = { kind: 'none' };

  /** Writes that were issued but never durably landed. */
  lostWrites: { key: string; reason: string }[] = [];

  constructor(seed?: Record<string, string>) {
    if (seed) for (const [k, v] of Object.entries(seed)) this.data.set(k, v);
  }

  async getItem(key: string): Promise<string | null> {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.writes++;
    if (this.dead) {
      this.lostWrites.push({ key, reason: 'process dead' });
      // A killed process never resolves; tests model this as a silent no-op
      // because the caller is gone too.
      return;
    }
    switch (this.fault.kind) {
      case 'full':
        if (this.writes > this.fault.afterWrites) {
          this.lostWrites.push({ key, reason: 'storage full' });
          throw new Error('SQLITE_FULL: database or disk is full');
        }
        break;
      case 'crash':
        if (this.writes > this.fault.afterWrites) {
          this.dead = true;
          this.lostWrites.push({ key, reason: 'crashed before write' });
          return;
        }
        break;
      case 'truncate':
        if (key === this.fault.key) {
          this.data.set(key, value.slice(0, Math.floor(value.length / 2)));
          return;
        }
        break;
    }
    this.data.set(key, value);
  }

  async removeItem(key: string): Promise<void> { this.data.delete(key); }

  /** Inspect the durable state, as it would be after a restart. */
  snapshot(): Record<string, string> { return Object.fromEntries(this.data); }
  get writeCount(): number { return this.writes; }
  reset() { this.writes = 0; this.dead = false; this.lostWrites = []; this.fault = { kind: 'none' }; }
}
