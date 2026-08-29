// Abstract repository interface — the "DataStore" from structure.md §7.
// packages/core depends only on this shape; apps/desktop supplies the concrete
// sql.js-backed implementation (electronDriver.ts). A future mobile app would
// supply a different implementation behind this same interface.

export interface DataStore {
  list<T>(table: string, where?: Record<string, unknown>): T[];
  get<T>(table: string, id: string): T | null;
  create<T extends Record<string, unknown>>(table: string, row: T): T;
  update(table: string, id: string, patch: Record<string, unknown>): void;
  /** Soft delete: sets deletedAt rather than removing the row. */
  remove(table: string, id: string): void;
  close(): void;
}
