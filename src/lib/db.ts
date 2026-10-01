let currentActor: string | null = null;

export function setDbActor(actor: string | null) {
  currentActor = actor;
}

/** Who is signed in, for main-process handlers that write in their own transaction. */
export function getDbActor(): string | null {
  return currentActor;
}

export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const api = (window as any).electronAPI;
  if (!api) return [];
  const result = await api.dbQuery(sql, params, currentActor);
  if (result.error) throw new Error(result.error);
  return result.rows;
}
