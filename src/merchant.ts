import type { EngineHttpClient } from "./http.js";
import type { ListOrdersParams, OrderList } from "./orders.js";
import type { ProductList } from "./products.js";

/** Fields populated by controllers/merchant.rs dashboard. Amounts are cents. */
export interface MerchantDashboard {
  total_revenue_cents: number;
  total_orders: number;
  orders_by_status: Record<string, number>;
}

/** The signed-in merchant's workspace. Pagination defaults to page 1, 20 per page (maximum 100). */
export class MerchantClient {
  constructor(private readonly http: EngineHttpClient) {}

  dashboard(): Promise<MerchantDashboard> {
    return this.http.request<MerchantDashboard>("/api/merchant/dashboard");
  }

  products(params: ListOrdersParams = {}): Promise<ProductList> {
    return this.http.request<ProductList>("/api/merchant/products", {
      query: { ...params },
    });
  }

  orders(params: ListOrdersParams = {}): Promise<OrderList> {
    return this.http.request<OrderList>("/api/merchant/orders", {
      query: { ...params },
    });
  }
}
