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

router.get(
  "/proxy-image/*",
  async (request: IRequest, env: AppEnv, ctx: ExecutionContext) => {
    const cacheKey = new Request(request.url.toString(), request);
    const cachedImage = await caches.default.match(cacheKey);
    const imagePath = request.url.replace(/.*\/proxy-image\//, "");

    if (cachedImage) {
      console.log(`Cache HIT for ${imagePath}`);
      return cachedImage;
    }

    const originImageResponse = await fetch(
      `https://macarthur-me-content.fly.dev/${imagePath}`
    );
    const modifiedResponse = new Response(originImageResponse.body, {
      status: originImageResponse.status,
      statusText: originImageResponse.statusText,
      headers: {
        ...originImageResponse.headers,
        "Cache-Control": "public, max-age=31560000",
      },
    });

    ctx.waitUntil(caches.default.put(cacheKey, modifiedResponse.clone()));

    return modifiedResponse;
  }
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
