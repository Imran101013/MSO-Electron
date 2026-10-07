let currentActor: string | null = null;

export function setDbActor(actor: string | null) {
  currentActor = actor;
}

/** Who is signed in, for main-process handlers that write in their own transaction. */
export function getDbActor(): string | null {
  return currentActor;
}

/**
 * Shown instead of the database's own error when a save refers to a record that is no longer there.
 * Every screen in the app writes records that exist in the database, so this happens only when the
 * window holds records from before the database was changed outside it (cleared, restored or
 * refilled while the app was open). The statement is refused as a whole, so nothing was saved.
 */
export const STALE_WINDOW_MESSAGE =
  "The records in this window are out of date: the database was changed after they were loaded. Nothing was saved. Reload the window (Ctrl+R), check the figures, and try again.";

// "insert or update on table "x" violates foreign key constraint "y"": a row pointing at a record
// (a member, loan or meeting) that doesn't exist.
const MISSING_RECORD = /^insert or update on table "[^"]+" violates foreign key constraint/;

export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const api = (window as any).electronAPI;
  if (!api) return [];
  const result = await api.dbQuery(sql, params, currentActor);
  if (result.error) throw new Error(MISSING_RECORD.test(result.error) ? STALE_WINDOW_MESSAGE : result.error);
  return result.rows;
}
