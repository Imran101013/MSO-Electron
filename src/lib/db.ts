export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const api = (window as any).electronAPI;
  if (!api) return [];
  const result = await api.dbQuery(sql, params);
  if (result.error) throw new Error(result.error);
  return result.rows;
}
