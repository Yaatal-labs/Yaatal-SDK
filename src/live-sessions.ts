import type { CatalogProduct } from "./catalog.js";
import type { EngineHttpClient } from "./http.js";

export interface LiveSession {
  id: string;
  merchant_id: string;
  product_id: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CurrentSessionProducts {
  session: LiveSession;
  products: CatalogProduct[];
}

/** started_view: starting again returns the existing active session. */
export interface StartedLiveSession {
  id: string;
  room: string;
  status: string;
  started_at: string;
}

export interface EndedLiveSession {
  id: string;
  status: string;
  ended_at: string | null;
}

export interface PinLiveSessionRequest {
  /** Omit or pass null to unpin. */
  product_id?: string | null;
  keyword?: string | null;
}

/** Public product fields from PinnedProduct, shared by pin, public and keyword. */
export interface LivePinnedProduct {
  product_id: string;
  name: string;
  price_fcfa: number;
  image_url: string | null;
  keyword: string | null;
  sheet_url: string;
}

export interface LiveSessionPin {
  pinned: LivePinnedProduct | null;
}

export interface LiveSessionKeywordRequest {
  /** At most 300 characters. */
  text: string;
}

export interface LiveSessionKeywordMatch {
  match: LivePinnedProduct | null;
}

export interface PublicLiveSession extends LiveSessionPin {
  id: string;
  status: string;
  seller: { name: string | null };
  livekit_url: string | null;
  keyword_channels: { telegram: string | null; whatsapp: string | null };
}

export type LiveEgressProvider = "telegram" | "youtube";
export type LiveEgressSource = "phone" | "obs";
export type LiveEgressLayout = "portrait" | "landscape";

/**
 * services/live_destinations.rs DestinationInput. Carries a stream key: transient, sent once,
 * never stored or logged by the SDK (the Engine never returns it either).
 */
export interface LiveEgressDestinationInput {
  provider: LiveEgressProvider;
  server_url: string;
  stream_key: string;
}

/** services/live_egress.rs StartInput (deny_unknown_fields: send exactly these). */
export interface StartLiveEgressRequest {
  /** Idempotency key you mint (UUID); replaying it returns the same job, a different body is 409. */
  request_id: string;
  source: LiveEgressSource;
  layout: LiveEgressLayout;
  destinations: LiveEgressDestinationInput[];
}

export interface LiveEgressJob {
  id: string;
  request_id: string;
  source: LiveEgressSource;
  layout: LiveEgressLayout;
  status: string;
  destinations: { provider: LiveEgressProvider; status: string }[];
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

/** services/live_egress.rs View. */
export interface LiveEgressView {
  enabled: boolean;
  providers: { telegram: boolean; youtube: boolean };
  job: LiveEgressJob | null;
}

export class LiveSessionsClient {
  constructor(private readonly http: EngineHttpClient) {}

  currentProducts(): Promise<CurrentSessionProducts> {
    return this.http.request<CurrentSessionProducts>(
      "/api/live-sessions/current/products",
    );
  }

  /** Start or reuse the merchant's active session. The handler accepts no request body. */
  start(): Promise<StartedLiveSession> {
    return this.http.request<StartedLiveSession>("/api/live-sessions/", { method: "POST" });
  }

  end(id: string): Promise<EndedLiveSession> {
    return this.http.request<EndedLiveSession>(
      `/api/live-sessions/${encodeURIComponent(id)}/end`,
      { method: "POST" },
    );
  }

  pin(id: string, input: PinLiveSessionRequest): Promise<LiveSessionPin> {
    return this.http.request<LiveSessionPin>(
      `/api/live-sessions/${encodeURIComponent(id)}/pin`,
      { method: "PUT", body: input },
    );
  }

  /** Anonymous lookup of a product keyword in the live chat. */
  keyword(id: string, input: LiveSessionKeywordRequest): Promise<LiveSessionKeywordMatch> {
    return this.http.request<LiveSessionKeywordMatch>(
      `/api/live-sessions/${encodeURIComponent(id)}/keyword`,
      { method: "POST", auth: false, body: input },
    );
  }

  /** Anonymous viewer projection; never sends the client's bearer token. */
  public(id: string): Promise<PublicLiveSession> {
    return this.http.request<PublicLiveSession>(
      `/api/live-sessions/${encodeURIComponent(id)}/public`,
      { auth: false },
    );
  }

  /** Owner-only multistream status. `enabled` is false until the server sets LIVE_EGRESS_ENABLED. */
  egress(id: string): Promise<LiveEgressView> {
    return this.http.request<LiveEgressView>(`/api/live-sessions/${encodeURIComponent(id)}/egress`);
  }

  /**
   * Start owner-only multistream. HTTP 503 not_configured without LIVE_EGRESS_ENABLED or LiveKit;
   * 409 session_ended / egress_conflict / request_conflict; 400 invalid_destination(s).
   * Destinations carry stream keys: transient, never logged or stored by the SDK.
   */
  startEgress(id: string, input: StartLiveEgressRequest): Promise<LiveEgressView> {
    return this.http.request<LiveEgressView>(
      `/api/live-sessions/${encodeURIComponent(id)}/egress`,
      { method: "POST", body: input },
    );
  }

  /** Stop an owner-only multistream job. */
  stopEgress(id: string, jobId: string): Promise<LiveEgressView> {
    return this.http.request<LiveEgressView>(
      `/api/live-sessions/${encodeURIComponent(id)}/egress/${encodeURIComponent(jobId)}/stop`,
      { method: "POST" },
    );
  }
}
