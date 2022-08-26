import { Router } from "itty-router";

interface AppEnv {
  MACARTHUR_ME: R2Bucket;
}

const router = Router();

router.routes.push([
  "GET",
  /(.*)transform-image\/src/,
  [
    async (request, event) => {
      let response = (await caches.default.match(
        request as Request
      )) as Response;

      if (!response) {
        const src = request.url.match(/.+transform-image\/src\/(.+)/)?.[1];

        if (!src) throw new Error("No image source found!");

        response = await fetch(src);

        const clonedResponse: Response = new Response(response.body, response);

        // one year
        clonedResponse.headers.set("Cache-Control", "public, max-age=31560000");
        clonedResponse.headers.set(
          "X-Special-Message",
          "Thanks for visiting Alex's site!"
        );

        event.waitUntil(
          caches.default.put(request as Request, clonedResponse.clone())
        );
        return clonedResponse;
      }

      return response;
    }
  ]
]);

/**
 * Cache static assets.
 */
router.routes.push([
  "GET",
  /.+?\.(css|woff2|svg)/,
  [
    async (request, event) => {
      let response = await caches.default.match(request as Request);

      if (!response) {
        response = await fetch(request as Request);
        const clonedResponse = new Response(response.body, response);

        // one year
        clonedResponse.headers.set("Cache-Control", "public, max-age=31560000");
        clonedResponse.headers.set(
          "X-Special-Message",
          "Thanks for visiting Alex's site!"
        );

        event.waitUntil(
          caches.default.put(request as Request, clonedResponse.clone())
        );

        return clonedResponse;
      }

      return response;
    }
  ]
]);

router.get("/js/numbers.js", async (request, ctx) => {
  let response = (await caches.default.match(request as Request)) as Response;

  if (!response) {
    response = await fetch("https://analytics.macarthur.me/js/plausible.js");
    const clonedResponse = new Response(response.body, response);

    const WEEK_IN_SECONDS = 604800;
    clonedResponse.headers.set(
      "Cache-Control",
      `public, max-age=${WEEK_IN_SECONDS}`
    );

    ctx.waitUntil(
      caches.default.put(request as Request, clonedResponse.clone())
    );

    return clonedResponse;
  }

  return response;
});

router.post("/api/event", async request => {
  const newRequest = new Request(request as Request);
  newRequest.headers.delete("cookie");

  return await fetch("https://analytics.macarthur.me/api/event", newRequest);
});

router.get(
  "/proxied-image/:imageId",
  async (request: Request, env: AppEnv, ctx: ExecutionContext) => {
    const { imageId } = (request as any).params;
    const cacheKey = new Request(request.url.toString(), request);
    const cachedImage = await caches.default.match(cacheKey);

    if (cachedImage) {
      console.log(`Cache HIT for ${imageId}`);
      return cachedImage;
    }

    console.log(`Cache MISS for ${imageId}`);
    const obj = await env.MACARTHUR_ME.get(decodeURIComponent(imageId));

    if (!obj) {
      return new Response(`Image not found: ${imageId}`, { status: 404 });
    }

    let acceptedHeaders: Record<string, string | undefined> = {
      "Content-Type": obj.httpMetadata.contentType,
      "Content-Encoding": obj.httpMetadata.contentEncoding,
      "Content-Disposition": obj.httpMetadata.contentDisposition,
      "Content-Language": obj?.httpMetadata.contentLanguage,
      Expires: obj.httpMetadata.cacheExpiry?.toUTCString()
    };

    let filteredHeaders = Object.entries(acceptedHeaders).filter(
      ([, headerValue]) => !!headerValue
    );
    let headers = Object.fromEntries(filteredHeaders) as Record<
      string,
      string | string
    >;

    headers["Cache-Control"] = "public, max-age=31560000";

    const response = new Response(obj?.body, { headers });

    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));

    return response;
  }
);

export default {
  async fetch(
    request: Request,
    env: AppEnv,
    context: ExecutionContext
  ): Promise<Response> {
    return router.handle(request, env, context);
  }
};
