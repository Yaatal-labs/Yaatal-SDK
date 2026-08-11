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

// ─── Delivery marketplace ────────────────────────────────────────────────────
//
// The courier side of delivery, served by the Engine at `/api/delivery/*`
// (note the singular — `/api/deliveries/*` above is the per-package lifecycle).
// Drivers register, a merchant assigns one to a package, and preferences
// decide which methods a merchant offers at checkout.

export interface DeliveryDriver {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  license_plate: string | null;
  id_number: string | null;
  zone: string;
  rating: number;
  active: boolean;
  /** `moto` | `car` | `truck` | `bicycle`. */
  vehicle_type: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterDriverRequest {
  name: string;
  phone: string;
  zone: string;
  vehicle_type: string;
  email?: string;
  license_plate?: string;
  id_number?: string;
}

export interface DriverList {
  drivers: DeliveryDriver[];
  total: number;
}

export interface AssignDeliveryRequest {
  delivery_id: string;
  driver_id: string;
}

/**
 * Merchant-facing preferences. No `merchant_id` — the merchant is the
 * authenticated caller, so the Engine drops it from the view.
 */
export interface MerchantDeliveryPreferences {
  default_method: string;
  preferred_carriers: string;
  delivery_zones: string;
  pickup_available: boolean;
  delivery_cost_markup: number;
  allow_customer_pickup: boolean;
  allow_self_delivery: boolean;
  allow_third_party: boolean;
  pickup_location: string | null;
  pickup_instructions: string | null;
}

/** Every field optional — a PATCH updates only what it carries. */
export type UpdateMerchantDeliveryPreferences = Partial<MerchantDeliveryPreferences>;

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

  // ── Marketplace ───────────────────────────────────────────────────────────

  /** Register a courier. `POST /api/delivery/drivers`. */
  registerDriver(request: RegisterDriverRequest): Promise<DeliveryDriver> {
    return this.http.request<DeliveryDriver>("/api/delivery/drivers", {
      method: "POST",
      body: request,
    });
  }

  /** Couriers, optionally narrowed to a zone. `GET /api/delivery/drivers`. */
  listDrivers(params: { zone?: string } = {}): Promise<DriverList> {
    return this.http.request<DriverList>("/api/delivery/drivers", {
      query: { ...params },
    });
  }

  /** Assign a courier to a package. `POST /api/delivery/assign`. */
  assign(request: AssignDeliveryRequest): Promise<Delivery> {
    return this.http.request<Delivery>("/api/delivery/assign", {
      method: "POST",
      body: request,
    });
  }

  /** The authenticated merchant's preferences. `GET /api/delivery/preferences`. */
  preferences(): Promise<MerchantDeliveryPreferences> {
    return this.http.request<MerchantDeliveryPreferences>(
      "/api/delivery/preferences",
    );
  }

  /** Partial update. `PATCH /api/delivery/preferences`. */
  updatePreferences(
    request: UpdateMerchantDeliveryPreferences,
  ): Promise<MerchantDeliveryPreferences> {
    return this.http.request<MerchantDeliveryPreferences>(
      "/api/delivery/preferences",
      { method: "PATCH", body: request },
    );
  }
}
