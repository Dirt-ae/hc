import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "dirtonly/index.html"),
        adminRoot: resolve(__dirname, "admin.html"),
      },
    },
  },
});
