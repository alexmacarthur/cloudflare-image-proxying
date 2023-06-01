import { Router, IRequest } from "itty-router";

interface AppEnv {}

const router = Router();

const YEAR_IN_SECONDS = 31560000;

router.get(
  "proxy-public/*",
  async (request: IRequest, _env: AppEnv, ctx: ExecutionContext) => {
    const cacheKey = new Request(request.url.toString(), request);
    const cachedAsset = await caches.default.match(cacheKey);
    const assetPath = request.url.replace(/.*\/proxy-public\//, "");

    if (cachedAsset) {
      console.log(`Cache HIT for ${assetPath}`);
      return cachedAsset;
    }

    const originImageResponse = await fetch(
      `https://macarthur.me/${assetPath}`
    );

    const modifiedResponse = new Response(originImageResponse.body, {
      status: originImageResponse.status,
      statusText: originImageResponse.statusText,
      headers: {
        ...originImageResponse.headers,
        "Cache-Control": `public, max-age=${YEAR_IN_SECONDS}, immutable`,
      },
    });

    ctx.waitUntil(caches.default.put(cacheKey, modifiedResponse.clone()));

    return modifiedResponse;
  }
);

router.get(
  "/proxy-image/*",
  async (request: IRequest, _env: AppEnv, ctx: ExecutionContext) => {
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
        "Cache-Control": `public, max-age=${YEAR_IN_SECONDS}, immutable`,
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
