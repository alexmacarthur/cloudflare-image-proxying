import { Router } from "itty-router";

const router = Router();

class AttributeRewriter {
  constructor(attributeName) {
    this.attributeName = attributeName
  }

  element(element) {
    const attribute = element.getAttribute(this.attributeName);

    if (attribute) {

      // Prefix any S3 image URLs with my own domain, so that I can later intercept and cache them.
      element.setAttribute(
        this.attributeName,
        attribute.replace('https://s3', 'https://test.macarthur.me/transform-image/src/https://s3')
      )
    }
  }
}

router.routes.push(
  [
    'GET',
    /(.*)transform-image\/src/,
    [(async (request, event) => {
      let response = await caches.default.match(request);

      if(!response) {
        const src = request.url.match(/.+transform-image\/src\/(.+)/)[1]

        response = await fetch(src);

        const clonedResponse = new Response(response.body, response);

        // one year
        clonedResponse.headers.set("Cache-Control", "public, max-age=31560000");
        clonedResponse.headers.set("X-Special-Message", "Thanks for visiting Alex's site!");

        event.waitUntil(caches.default.put(request, clonedResponse.clone()));
        return clonedResponse;
      }

      return response;
    })]
  ]
)

/**
 * Cache static assets.
 */
router.routes.push(
  [
    'GET',
    /.+?\.(css|woff2|jp(e?)g|png|svg)/,
    [(async (request, event) => {
      let response = await caches.default.match(request);

      if (!response) {
        response = await fetch(request);
        const clonedResponse = new Response(response.body, response);

        // one year
        clonedResponse.headers.set("Cache-Control", "public, max-age=31560000");
        clonedResponse.headers.set("X-Special-Message", "Thanks for visiting Alex's site!");

        event.waitUntil(caches.default.put(request, clonedResponse.clone()));

        return clonedResponse;
      }

      return response;
    })]
  ]
)

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

router.post("/api/event", async request => {
  const newRequest = new Request(request);
  newRequest.headers.delete("cookie");

  return await fetch("https://analytics.macarthur.me/api/event", newRequest);
});

const imageRewriter = new HTMLRewriter()
  .on('img', new AttributeRewriter('src'));

router.get('/*', async (request) => {
  const response = await fetch(request);

  return imageRewriter.transform(response);
});

addEventListener("fetch", event => {
  event.passThroughOnException();

  event.respondWith(router.handle(event.request, event));
});
