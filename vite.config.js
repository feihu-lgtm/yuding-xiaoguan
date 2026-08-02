import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/yuding-xiaoguan/",
  plugins: [react()],
  test: {
    environment: "node",
  },
});
