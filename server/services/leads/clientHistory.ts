/**
 * True only when the Client has real past business — not merely a stub
 * row auto-created from a prior inquiry (0 events, is_returning false).
 */
export function isPastClient(client: {
  totalEvents?: number | null;
  isReturning?: boolean | null;
}): boolean {
  return (client.totalEvents ?? 0) > 0 || client.isReturning === true;
}
