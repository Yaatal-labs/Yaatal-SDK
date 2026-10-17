import type { EngineHttpClient } from "./http.js";

export type LiveKitRoomType = "one_to_one" | "multi_party" | "broadcast";

export interface LiveKitTokenRequest {
  /** Required for one_to_one; ignored for broadcast. */
  room?: string;
  /** Required for broadcast; the Engine derives the room and publish rights from this session. */
  live_session_id?: string | null;
  /** Defaults to "one_to_one". */
  room_type?: LiveKitRoomType;
  /** Defaults to false. */
  enable_recording?: boolean;
  /** Defaults to true. */
  can_publish?: boolean;
  /** Defaults to true. */
  can_subscribe?: boolean;
}

/** Anonymous, watch-only token for an active live session. */
export interface LiveKitViewerTokenRequest {
  live_session_id: string;
}

export interface LiveKitTokenResponse {
  token: string;
  /** The LiveKit server to connect to with that token. */
  url: string;
  room: string;
  identity: string;
  recording_enabled: boolean;
}

/** Real-time audio/video rooms (live selling, calls). */
export class LiveKitClient {
  constructor(private readonly http: EngineHttpClient) {}

  /** Requires sign-in. multi_party returns HTTP 501. Broadcast grants depend on session ownership. */
  token(request: LiveKitTokenRequest): Promise<LiveKitTokenResponse> {
    return this.http.request<LiveKitTokenResponse>("/api/livekit/token", {
      method: "POST",
      body: request,
    });
  }

  /** Anonymous watch-only broadcast token; never sends the client's bearer token. */
  viewerToken(input: LiveKitViewerTokenRequest): Promise<LiveKitTokenResponse> {
    return this.http.request<LiveKitTokenResponse>("/api/livekit/viewer-token", {
      method: "POST",
      auth: false,
      body: input,
    });
  }
}
