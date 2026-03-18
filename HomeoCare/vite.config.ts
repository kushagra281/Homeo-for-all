import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => {
  const plugins = [react()];

  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID) {
    const runtimeErrorOverlay = (await import("@replit/vite-plugin-runtime-error-modal")).default;
    plugins.push(runtimeErrorOverlay());
  }

  return {
    plugins,
  };
});
