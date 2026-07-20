import handler from "vinext/server/fetch-handler";

type VinextHandler = {
  fetch: (
    request: Request,
    environment: unknown,
    context: unknown,
  ) => Response | Promise<Response>;
};

const vinext = handler as unknown as VinextHandler;

export default {
  async fetch(request: Request, environment: unknown, context: unknown) {
    const response = await vinext.fetch(request, environment, context);
    const headers = new Headers(response.headers);
    headers.set(
      "Permissions-Policy",
      "accelerometer=(self), gyroscope=(self)",
    );
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
