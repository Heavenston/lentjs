import { defineConfig } from 'vite'
import LentJS from "@lentjs/vitejs-plugin";

export default defineConfig({
  server: {
    port: 1234,
  },

  oxc: false,

  plugins: [LentJS()],
});
