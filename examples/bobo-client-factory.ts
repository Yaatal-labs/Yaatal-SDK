import {
  createYaatalClient,
  type BoboCheckoutRequest,
  type YaatalClient,
} from "@yaatal/client";

export interface BoboApiOptions {
  engineUrl?: string;
  token?: string;
}

export function makeYaatalClient(options: BoboApiOptions = {}): YaatalClient {
  return createYaatalClient({
    baseUrl: options.engineUrl ?? process.env.EXPO_PUBLIC_ENGINE_API_URL,
    token: options.token,
  });
}

export function createBoboApi(options: BoboApiOptions = {}) {
  const client = makeYaatalClient(options);

  return {
    searchProducts: (q: string) => client.search.products({ q, limit: 20 }),
    checkout: (request: BoboCheckoutRequest) => client.bobo.checkout(request),
    listOrders: () => client.bobo.listOrders({ limit: 25 }),
    confirmDelivery: (orderId: number) => client.bobo.confirmDelivery(orderId),
    unreadNotifications: () => client.notifications.unreadCount(),
    track: (event: string) => client.analytics.track({ event }),
  };
}
