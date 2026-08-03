import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { registerRoutes } from "../routes/index.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  registerRoutes(app);

  return app;
}
