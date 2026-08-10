export function matchesSearch(query: string, ...fields: Array<string | number | null | undefined>): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return fields.some((field) => field !== null && field !== undefined && String(field).toLowerCase().includes(normalizedQuery));
}
