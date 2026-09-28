import type { EngineHttpClient } from "./http.js";

export type LiveKitRoomType = "one_to_one" | "multi_party" | "broadcast";

export interface LiveKitTokenRequest {
  room: string;
  /** Defaults to "one_to_one". */
  room_type?: LiveKitRoomType;
  /** Defaults to false. */
  enable_recording?: boolean;
  /** Defaults to true. */
  can_publish?: boolean;
  /** Defaults to true. */
  can_subscribe?: boolean;
}

export interface LiveKitTokenResponse {
  token: string;
  /** The LiveKit server to connect to with that token. */
  url: string;
  room: string;
  identity: string;
  recording_enabled: boolean;
}

/** Real-time audio/video rooms (live selling, calls). Requires a signed-in client. */
export class LiveKitClient {
  constructor(private readonly http: EngineHttpClient) {}

  token(request: LiveKitTokenRequest): Promise<LiveKitTokenResponse> {
    return this.http.request<LiveKitTokenResponse>("/api/livekit/token", {
      method: "POST",
      body: request,
    });
  }
}
