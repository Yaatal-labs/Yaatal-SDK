import { createYaatalClient } from "../dist/index.js";

const requests = [];

const fetchMock = async (input, init = {}) => {
  requests.push({
    url: String(input),
    method: init.method,
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    body: init.body,
  });

  return new Response(
    JSON.stringify({
      products: [],
      total: 0,
      page: 1,
      per_page: 20,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};

const client = createYaatalClient({
  baseUrl: "https://engine.example.test/",
  token: "example-token",
  fetch: fetchMock,
});

await client.search.products({ q: "rice", limit: 20 });

const [request] = requests;
console.log(request.method ?? "GET", request.url);
console.log(request.headers.authorization);
