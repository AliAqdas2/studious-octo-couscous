import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { registerRoutes } from "../routes/index.js";
import { registerTrainingVideos } from "../videos.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  registerRoutes(app);
  registerTrainingVideos(app);

  return app;
}
