import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/session": "http://localhost:3001",
      "/convert": "http://localhost:3001",
    },
  },
});
