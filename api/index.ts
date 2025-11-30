import { app, setupApp } from "../server/index";

export default async function handler(req: any, res: any) {
  try {
    await setupApp();
    app(req, res);
  } catch (e) {
    console.error("Server initialization failed:", e);
    res.status(500).json({ 
      error: "Server initialization failed", 
      details: e instanceof Error ? e.message : String(e) 
    });
  }
}
