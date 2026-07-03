import type { EngineHttpClient } from "./http.js";

export type DeliveryStatus =
  | "requested"
  | "accepted"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled";

export interface Delivery {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  method: string;
  status: DeliveryStatus;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  phone_number?: string | null;
  notes?: string | null;
  proof_note?: string | null;
  confirmed_at?: string | null;
  /** One-time confirmation code written to the package's NFC tag / QR. */
  delivery_code?: string | null;
  /** Set once the code has confirmed a delivery; a used code never confirms again. */
  code_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryRequest {
  order_id: string;
  method?: string;
  pickup_address?: string;
  dropoff_address?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  phone_number?: string;
  notes?: string;
}

export interface ListDeliveriesParams {
  order_id?: string;
  status?: DeliveryStatus;
  limit?: number;
}

export interface UpdateDeliveryStatusRequest {
  status: DeliveryStatus;
  proof_note?: string;
}

export interface ConfirmDeliveryRequest {
  proof_note?: string;
}

export interface ConfirmDeliveryByCodeRequest {
  delivery_code: string;
  proof_note?: string;
}

export interface ConfirmDeliveryByCodeResponse {
  status: "confirmed";
  delivery_id: string;
  order_id: string;
  payment_released: boolean;
}

export class DeliveryClient {
  constructor(private readonly http: EngineHttpClient) {}

  create(request: CreateDeliveryRequest): Promise<Delivery> {
    return this.http.request<Delivery>("/api/deliveries", {
      method: "POST",
      body: request,
    });
  }

  list(params: ListDeliveriesParams = {}): Promise<Delivery[]> {
    return this.http.request<Delivery[]>("/api/deliveries", {
      query: { ...params },
    });
  }

  get(id: string): Promise<Delivery> {
    return this.http.request<Delivery>(
      `/api/deliveries/${encodeURIComponent(id)}`,
    );
  }

  updateStatus(
    id: string,
    request: UpdateDeliveryStatusRequest,
  ): Promise<Delivery> {
    return this.http.request<Delivery>(
      `/api/deliveries/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: request,
      },
    );
  }

  confirm(id: string, request: ConfirmDeliveryRequest = {}): Promise<Delivery> {
    return this.http.request<Delivery>(
      `/api/deliveries/${encodeURIComponent(id)}/confirm`,
      {
        method: "POST",
        body: request,
      },
    );
  }

  /**
   * Anonymous confirmation via the package's one-time delivery code (NFC tap
   * / QR scan). No bearer token required — possession of the code is the
   * authentication. Releases escrowed payment when the order is BOBO-linked.
   */
  confirmByCode(
    request: ConfirmDeliveryByCodeRequest,
  ): Promise<ConfirmDeliveryByCodeResponse> {
    return this.http.request<ConfirmDeliveryByCodeResponse>(
      "/api/deliveries/confirm-by-code",
      {
        method: "POST",
        body: request,
      },
    );
  }
}
