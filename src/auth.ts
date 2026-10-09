import type { EngineHttpClient } from "./http.js";

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  pid: string;
  name: string;
  is_verified: boolean;
}

export interface CurrentUser {
  pid: string;
  name: string;
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface MagicLinkRequest {
  email: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export class AuthClient {
  constructor(private readonly http: EngineHttpClient) {}

  async register(request: RegisterRequest): Promise<void> {
    await this.http.request<void>("/api/auth/register", {
      method: "POST",
      body: request,
    });
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await this.http.request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: request,
    });
    this.http.setToken(response.token);
    return response;
  }

  current(): Promise<CurrentUser> {
    return this.http.request<CurrentUser>("/api/auth/current");
  }

  async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
    await this.http.request<void>("/api/auth/forgot", {
      method: "POST",
      body: request,
    });
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    await this.http.request<void>("/api/auth/reset", {
      method: "POST",
      body: request,
    });
  }

  async requestMagicLink(request: MagicLinkRequest): Promise<void> {
    await this.http.request<void>("/api/auth/magic-link", {
      method: "POST",
      body: request,
    });
  }

  async verifyMagicLink(token: string): Promise<LoginResponse> {
    const response = await this.http.request<LoginResponse>(
      `/api/auth/magic-link/${encodeURIComponent(token)}`,
    );
    this.http.setToken(response.token);
    return response;
  }

  async resendVerification(request: ResendVerificationRequest): Promise<void> {
    await this.http.request<void>("/api/auth/resend-verification-mail", {
      method: "POST",
      body: request,
    });
  }

  /** Confirm an email address with the token from the verification mail. */
  async verifyEmail(token: string): Promise<void> {
    await this.http.request<void>(`/api/auth/verify/${encodeURIComponent(token)}`);
  }

  /**
   * Start a WhatsApp sign-in. Open `whatsapp_url`: the person sends the prefilled message from
   * their own WhatsApp, and Engine replies there with a 6-digit code. Poll `whatsappStatus` until
   * `code_sent`, then `verifyWhatsApp` with that code. The user starts the conversation, so this
   * needs no WhatsApp template.
   */
  startWhatsApp(): Promise<WhatsAppLoginStart> {
    return this.http.request<WhatsAppLoginStart>("/api/auth/whatsapp/start", {
      method: "POST",
    });
  }

  /** Whether the WhatsApp message for this attempt has arrived and its code has been sent. */
  whatsappStatus(nonce: string): Promise<WhatsAppLoginStatus> {
    return this.http.request<WhatsAppLoginStatus>(
      `/api/auth/whatsapp/status/${encodeURIComponent(nonce)}`,
    );
  }

  /** Finish a WhatsApp sign-in with the code; the session token is kept on this client. */
  async verifyWhatsApp(request: WhatsAppVerifyRequest): Promise<LoginResponse> {
    const response = await this.http.request<LoginResponse>("/api/auth/whatsapp/verify", {
      method: "POST",
      body: request,
    });
    this.http.setToken(response.token);
    return response;
  }

  /**
   * Mint a short-lived, single-use grant that lets an embedded surface (Studio, Shop) confirm who
   * is signed in without ever holding the session token. Requires a signed-in client.
   */
  startBootstrap(request: BootstrapStartRequest): Promise<BootstrapStartResponse> {
    return this.http.request<BootstrapStartResponse>("/api/auth/bootstrap/start", {
      method: "POST",
      body: request,
    });
  }

  /** Redeem a bootstrap grant on the surface it was minted for. Returns identity, not a token. */
  redeemBootstrap(request: BootstrapRedeemRequest): Promise<BootstrapRedeemResponse> {
    return this.http.request<BootstrapRedeemResponse>("/api/auth/bootstrap", {
      method: "POST",
      body: request,
    });
  }
}

export interface WhatsAppLoginStart {
  /** Ties the WhatsApp message to this attempt; not a secret (it travels in the link). */
  nonce: string;
  /** wa.me deep link with the prefilled login message. */
  whatsapp_url: string;
  expires_in_seconds: number;
}

export interface WhatsAppLoginStatus {
  code_sent: boolean;
}

export interface WhatsAppVerifyRequest {
  nonce: string;
  /** The 6-digit code Engine sent back over WhatsApp. */
  code: string;
}

/** Surfaces Engine issues bootstrap grants for. */
export type BootstrapSurface = "studio" | "shop";

export interface BootstrapStartRequest {
  surface: BootstrapSurface;
}

export interface BootstrapStartResponse {
  nonce: string;
  surface: BootstrapSurface;
  expires_in_seconds: number;
}

export interface BootstrapRedeemRequest {
  nonce: string;
  surface: BootstrapSurface;
}

export interface BootstrapRedeemResponse {
  authenticated: boolean;
  surface: BootstrapSurface;
  pid: string;
  name: string;
  is_verified: boolean;
}
