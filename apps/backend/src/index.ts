import express from "express";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { errorHandler } from "./common/middlewares/error-handler.middleware.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`backend listening on port ${env.PORT}`);
});
