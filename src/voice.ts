import type { EngineHttpClient } from "./http.js";

export interface TranscriptionResponse {
  transcription: string;
}

export interface TranscribeOptions {
  /** The audio's media type, e.g. "audio/wav" or "audio/webm". Defaults to "application/octet-stream". */
  contentType?: string;
}

export class VoiceClient {
  constructor(private readonly http: EngineHttpClient) {}

  /** Transcribe one audio clip. The body is the raw audio, not JSON. Requires a signed-in client. */
  transcribe(
    audio: Blob | ArrayBuffer | Uint8Array,
    options: TranscribeOptions = {},
  ): Promise<TranscriptionResponse> {
    return this.http.request<TranscriptionResponse>("/api/voice/transcribe", {
      method: "POST",
      rawBody: audio as BodyInit,
      headers: { "Content-Type": options.contentType ?? "application/octet-stream" },
    });
  }

  /**
   * The WebSocket URL for a live voice session. Browsers cannot set headers on a WebSocket, so the
   * session token travels in the query string; treat the URL as a secret and do not log it.
   */
  sessionUrl(token?: string): string {
    const sessionToken = token ?? this.http.currentToken();
    if (!sessionToken) {
      throw new Error("A voice session needs a signed-in client or an explicit token.");
    }
    return this.http.url("/api/voice/session", { token: sessionToken }).replace(/^http/, "ws");
  }
}
