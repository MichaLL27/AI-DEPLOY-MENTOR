import { app, setupApp } from "../server/index";

export default async function handler(req: any, res: any) {
  try {
    // Ensure setup is complete before handling request
    await setupApp();
    
    // Forward request to Express app
    app(req, res);
  } catch (e) {
    console.error("Server initialization failed:", e);
    
    // Ensure we send a JSON response even on crash
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Server initialization failed", 
        details: e instanceof Error ? e.message : String(e) 
      });
    }
  }
}
