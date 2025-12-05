import { setupApp, httpServer, log } from "./index";

(async () => {
  await setupApp();
  const port = parseInt(process.env.PORT || "5000", 10);

  // Fix for Render 502 errors (Keep-Alive Timeout)
  httpServer.keepAliveTimeout = 120 * 1000;
  httpServer.headersTimeout = 120 * 1000;

  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})();
