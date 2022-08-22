import { Router } from "itty-router";

const router = Router();

router.post("/api/event", async request => {
  const newRequest = new Request(request);
  newRequest.headers.delete("cookie");

  return await fetch("https://analytics.macarthur.me/api/event", newRequest);
});

router.get("/**/*.woff2", async (request, event) => {
  let response = await caches.default.match(request);

  if (!response) {
    response = await fetch(request);
    const clonedResponse = new Response(response.body, response);

    // one year
    clonedResponse.headers.set("Cache-Control", "public, max-age=31560000");

    event.waitUntil(caches.default.put(request, clonedResponse.clone()));

    return clonedResponse;
  }

  return response;
});

router.get("/js/numbers.js", async (request, event) => {
  let response = await caches.default.match(request);

  if (!response) {
    response = await fetch("https://analytics.macarthur.me/js/plausible.js");
    const clonedResponse = new Response(response.body, response);

    const WEEK_IN_SECONDS = 604800;
    clonedResponse.headers.set(
      "Cache-Control",
      `public, max-age=${WEEK_IN_SECONDS}`
    );

    event.waitUntil(caches.default.put(request, clonedResponse.clone()));

    return clonedResponse;
  }

  return response;
});

addEventListener("fetch", event => {
  event.passThroughOnException();

  event.respondWith(router.handle(event.request, event));
});
