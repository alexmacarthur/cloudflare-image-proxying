import { Router } from "itty-router";

interface AppEnv {
  MACARTHUR_ME: R2Bucket;
}

const router = Router();

router.get(
  "/proxy/:imageId",
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
    context.passThroughOnException();

    return router.handle(request, env, context).then(response => response);
  }
};
