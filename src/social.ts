import type { EngineHttpClient } from "./http.js";

export interface SocialEvent {
  id: string;
  platform: string;
  kind: string;
  external_id: string;
  sender: string;
  body: string | null;
  received_at: string;
  created_at: string;
}

export interface ListSocialEventsParams {
  platform?: string;
  kind?: string;
  /** RFC3339 timestamp; only events received strictly after this are returned. */
  since?: string;
  limit?: number;
}

export class SocialClient {
  constructor(private readonly http: EngineHttpClient) {}

  /** Newest-first. */
  events(params: ListSocialEventsParams = {}): Promise<SocialEvent[]> {
    return this.http.request<SocialEvent[]>("/api/social/events", {
      query: { ...params },
    });
  }
}
