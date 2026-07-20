import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { interpretHandler } from "./server/interpret.ts";

dotenv.config();

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "taro-api",
      configureServer(server) {
        server.middlewares.use("/api/interpret", interpretHandler());
      },
      configurePreviewServer(server) {
        server.middlewares.use("/api/interpret", interpretHandler());
      },
    },
  ],
});
