import { EngineHttpClient, type FetchLike } from "./http.js";

// The Gloop voice Worker's order and board routes (Yaatal-labs/gloop-lab voice-cf/worker.js): a public order
// endpoint, a read-only board feed, forward-only status moves and an ingest door for other stacks.
//
// Who may call what:
//   /api/order, /api/board, /api/board/status  `x-demo-key` (server-side callers) OR a browser Origin on the
//                                              Worker's site allow-list (then no key). Both are options below.
//   /api/board/status                          also `x-staff-pin` when the board is PIN-protected.
//   /api/ingest                                `x-ingest-key` only.

const DEFAULT_BASE_URL = "https://glooplab-voice.ameth749.workers.dev";

export interface BoardsClientOptions {
  /** The Worker origin. Defaults to https://glooplab-voice.ameth749.workers.dev. */
  baseUrl?: string;
  /** Sent as `x-demo-key`. Server-side only; a browser on an allowed site origin needs none. */
  demoKey?: string;
  /** Sent as `x-ingest-key` on `ingest` only. */
  ingestKey?: string;
  /** Extra headers on every call, e.g. `{ origin: "https://growthlooplab.com" }` from a server. */
  headers?: HeadersInit;
  fetch?: FetchLike | undefined;
}

export interface BoardOrderItem {
  id: string;
  /** Crate and quantity catalogs (e.g. nia, dioum). */
  qty?: number;
  /** Sized catalogs (e.g. ivy): XS, S, M, L, XL. */
  size?: string;
}

/** POST /api/order body. The Worker validates against a per-`agent` catalog and answers 400 `{error: field}`. */
export interface OrderRequest {
  /** Catalog row; the Worker defaults to "nia". */
  agent?: string;
  name: string;
  /** Digits, space, + ( ) - only. A phone or an instagram handle is required. */
  phone?: string;
  instagram?: string;
  fulfil: "pickup" | "delivery" | "fitting";
  /** Crate catalogs: "small" | "medium" | "large". */
  size?: string;
  /** YYYY-MM-DD, today or later, for dated fulfilment. */
  date?: string;
  /** HH:MM, 24 hour. */
  time?: string;
  address?: string;
  items: BoardOrderItem[];
  notes?: string;
}

export interface OrderReceipt {
  ok: true;
  id: number;
}

export type BoardStatus = "needs_review" | "new" | "prepping" | "packed" | "done";

/** One board card: last 48 hours, first name only, no contact data. Extra keys (items, date, guests...) vary by agent. */
export interface BoardOrder {
  id: number;
  created_at: string;
  source: "web" | "phone";
  status: BoardStatus;
  name: string;
  [extra: string]: unknown;
}

export interface BoardMove {
  agent: string;
  id: number;
  /** Forward one step only: new/needs_review -> prepping -> packed -> done. */
  to: "prepping" | "packed" | "done";
}

export interface IngestRequest {
  /** Lowercase slug, at most 24 characters. */
  agent: string;
  session?: string;
  payload: Record<string, unknown>;
  /** Label for the request's origin, e.g. "Phone (Bocalines)". */
  source?: string;
}

const AGENT_SLUG = /^[a-z][a-z0-9_-]*$/;

export class BoardsClient {
  private readonly http: EngineHttpClient;
  private readonly ingestKey: string | undefined;

  constructor(options: BoardsClientOptions = {}) {
    const headers = new Headers(options.headers);
    if (options.demoKey) headers.set("x-demo-key", options.demoKey);
    this.ingestKey = options.ingestKey;
    this.http = new EngineHttpClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      headers,
      fetch: options.fetch,
    });
  }

  order(order: OrderRequest): Promise<OrderReceipt> {
    if (typeof order.name !== "string" || !order.name.trim() || order.name.length > 60) {
      throw new Error("name is required, at most 60 characters.");
    }
    if (!order.phone && !order.instagram) throw new Error("A phone or an instagram handle is required.");
    if (!Array.isArray(order.items) || order.items.length < 1) throw new Error("items needs at least one entry.");
    if (order.notes !== undefined && order.notes.length > 300) throw new Error("notes is at most 300 characters.");
    return this.http.request<OrderReceipt>("/api/order", { method: "POST", body: order });
  }

  async board(agent: string): Promise<BoardOrder[]> {
    const feed = await this.http.request<{ orders: BoardOrder[] }>("/api/board", { query: { agent } });
    return feed.orders;
  }

  /** Move one ticket a single step forward. Pass `staffPin` for a PIN-protected board. */
  setStatus(move: BoardMove, options: { staffPin?: string } = {}): Promise<{ ok: true; status: string }> {
    if (!Number.isInteger(move.id) || move.id < 1) throw new Error("id must be a positive integer.");
    if (!["prepping", "packed", "done"].includes(move.to)) throw new Error("to must be prepping, packed or done.");
    return this.http.request<{ ok: true; status: string }>("/api/board/status", {
      method: "POST",
      body: move,
      ...(options.staffPin ? { headers: { "x-staff-pin": options.staffPin } } : {}),
    });
  }

  /** Land a request from another stack (a phone agent) on the same board. Needs `ingestKey`. */
  ingest(request: IngestRequest): Promise<{ ok: true; id: number }> {
    if (!this.ingestKey) throw new Error("ingest needs the ingestKey option.");
    if (!AGENT_SLUG.test(request.agent) || request.agent.length > 24) throw new Error("agent must be a lowercase slug of at most 24 characters.");
    return this.http.request<{ ok: true; id: number }>("/api/ingest", {
      method: "POST",
      body: request,
      headers: { "x-ingest-key": this.ingestKey },
    });
  }
}

export function createBoardsClient(options: BoardsClientOptions = {}): BoardsClient {
  return new BoardsClient(options);
}
