import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // 相对路径：本地 dev 与 GitHub Pages 子路径都兼容
  plugins: [react()],
  test: {
    environment: "node",
  },
});
