import { SUPABASE_URL } from './ownerAuth';

export type InventoryBook = { key: string; name: string; status: string; reference_only: boolean;
  started_at: string; completed_at: string; warnings: Array<{ error?: string; kind?: string; source_event_id?: string }>;
  counts: Record<string, number> };
export type InventoryEvent = { key: string; book: string; source_event_id: string; name: string; sport: string;
  competition: string; start: string | null; phase: string; captured_at: string | null; inventory_status: string;
  markets: number; positions: number; priced_positions: number; object: string };
export type InventorySelection = { id: string; label: string; subject: string; price: string | null; point: string | null;
  available: boolean; captured_at: string | null; source_position: number; offered_price: string | null;
  pricing_resolved: boolean; pricing_verified: boolean; pricing_warning: string; native_context: string; native_legs: string | null;
  legs: Array<{ market?: string; selection?: string; point?: string | null; native_reference?: string;
    operations: Array<[number, string]> }> };
export type InventoryMarket = { id: string; name: string; kind: string; variant: string; native_context: string; selections: InventorySelection[] };
export type InventoryCatalogue = { schema: number; snapshot_id: string; prepared_at_utc: string; scope: string;
  books: InventoryBook[]; events: InventoryEvent[]; totals: Record<string, number>;
  objects: Record<string, { sha256: string; bytes: number; decoded_bytes: number }> };

const base = `${SUPABASE_URL}/storage/v1/object/public/odds-inventory/`;
const MAX_DECODED = 96 * 1024 * 1024;

async function compressed(path: string, sha256: string, bytes: number, signal: AbortSignal): Promise<string> {
  if (!/^snapshots\/[a-f0-9]{24}\/(?:catalogue\.json\.gz|[a-z0-9_]+\/[a-f0-9]{2}\.jsonl\.gz)$/.test(path)) throw new Error('Invalid inventory location.');
  if (!/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 50*1024*1024) throw new Error('Invalid inventory integrity metadata.');
  const response = await fetch(base + path, { signal });
  if (!response.ok) throw new Error('Could not load the captured markets.');
  const raw = await response.arrayBuffer();
  if (raw.byteLength !== bytes) throw new Error('Captured markets have an unexpected size.');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== sha256) throw new Error('Captured markets failed their integrity check.');
  if (typeof DecompressionStream === 'undefined') throw new Error('Use a current browser to view captured markets.');
  const reader = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_DECODED) throw new Error('This captured inventory is too large to open safely.');
      chunks.push(next.value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const decoded = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { decoded.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(decoded);
}

export async function loadInventory(signal: AbortSignal): Promise<InventoryCatalogue> {
  if (!SUPABASE_URL) throw new Error('Captured markets are not configured.');
  const response = await fetch(base + 'current.json', { cache: 'no-store', signal });
  if (response.status === 404) throw new Error('The captured market inventory has not been published yet.');
  if (!response.ok) throw new Error('Could not reach the captured market inventory.');
  const pointer = await response.json() as { schema: number; snapshot_id: string; catalogue: string; sha256: string; bytes: number };
  if (pointer.schema !== 1 || !/^[a-f0-9]{24}$/.test(pointer.snapshot_id)
    || pointer.catalogue !== `snapshots/${pointer.snapshot_id}/catalogue.json.gz`) throw new Error('Invalid inventory snapshot.');
  const catalogue = JSON.parse(await compressed(pointer.catalogue, pointer.sha256, pointer.bytes, signal)) as InventoryCatalogue;
  if (catalogue.schema !== 1 || catalogue.snapshot_id !== pointer.snapshot_id || !Array.isArray(catalogue.books)
    || !Array.isArray(catalogue.events)) throw new Error('Invalid inventory catalogue.');
  return catalogue;
}

export async function loadMarkets(catalogue: InventoryCatalogue, event: InventoryEvent,
  signal: AbortSignal): Promise<InventoryMarket[]> {
  const object = catalogue.objects[event.object];
  if (!object) throw new Error('This game has no published source inventory.');
  const lines = await compressed(`snapshots/${catalogue.snapshot_id}/${event.object}`, object.sha256, object.bytes, signal);
  const record = lines.split('\n').filter(Boolean).map(line => JSON.parse(line) as { key: string; markets: InventoryMarket[] })
    .filter(row => row.key === event.key);
  if (record.length !== 1 || !Array.isArray(record[0].markets)) throw new Error('Captured game identity is missing or ambiguous.');
  const markets = record[0].markets;
  if (markets.length !== event.markets || markets.reduce((n, m) => n + m.selections.length, 0) !== event.positions) {
    throw new Error('The game inventory does not account for every captured selection.');
  }
  const positions = { straight: new Set<number>(), combined: new Set<number>() };
  for (const market of markets) {
    if (market.kind !== 'straight' && market.kind !== 'combined') throw new Error('Invalid source market kind.');
    const supplied = positions[market.kind];
    for (const selection of market.selections) {
      if (!Number.isSafeInteger(selection.source_position) || selection.source_position < 0 || supplied.has(selection.source_position)) {
        throw new Error('Duplicate or invalid captured source position.');
      }
      supplied.add(selection.source_position);
    }
  }
  for (const supplied of Object.values(positions)) {
    for (let i = 0; i < supplied.size; i++) if (!supplied.has(i)) throw new Error('Missing original captured source position.');
  }
  return markets;
}
