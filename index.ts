import { Router, IRequest } from "itty-router";

interface AppEnv {
  MACARTHUR_ME: R2Bucket;
}

const router = Router();

router.get(
  "/proxy/:imageId",
  async (request: IRequest, env: AppEnv, ctx: ExecutionContext) => {
    const { imageId } = request.params;
    const cacheKey = new Request(request.url.toString(), request);
    const cachedImage = await caches.default.match(cacheKey);

    if (cachedImage) {
      console.log(`Cache HIT for ${imageId}`);
      return cachedImage;
    }

    const obj = await env.MACARTHUR_ME.get(imageId);

    if (!obj) {
      return new Response(`Image not found: ${imageId}`, { status: 404 });
    }

    let headers = {
      "Content-Type": obj.httpMetadata!.contentType as string,
      "Cache-Control": "public, max-age=31560000",
    };

    const response = new Response(obj?.body, { headers });

    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));

    return response;
  }
);

router.get("/color/*", async () =>
  fetch("https://color-macarthur-me.netlify.app")
);

export default {
  async fetch(
    request: Request,
    env: AppEnv,
    context: ExecutionContext
  ): Promise<Response> {
    context.passThroughOnException();

    return router.handle(request, env, context).then((response) => response);
  },
};
