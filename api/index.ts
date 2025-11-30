import { app, setupApp } from "../server/index";

let ready = false;

export default async function handler(req: any, res: any) {
  if (!ready) {
    await setupApp();
    ready = true;
  }
  app(req, res);
}
