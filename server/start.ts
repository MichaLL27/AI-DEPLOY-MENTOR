import { setupApp, httpServer, log } from "./index";

(async () => {
  await setupApp();
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})();
