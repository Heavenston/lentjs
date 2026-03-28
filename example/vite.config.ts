import { type Plugin, defineConfig } from 'vite'
import * as fs from "fs/promises";

export default defineConfig({
  server: {
    port: 1234,
  },

  oxc: {
    jsx: {
      importSource: "lent",
    },
  },

  plugins: [
    (() => ({
      name: "lent-ssr",
      enforce: "pre",

      configureServer: (server) => {
        server.middlewares.use(async (req, res) => {
          console.log("MIDDLEWARE");

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Powered-By', 'Qwik Vite Dev Server');
          res.writeHead(200);

          let html = await fs.readFile("./index.html", { encoding: "utf-8" });
          html = await server.transformIndexHtml(req.url!, html);

          const { render } = await server.ssrLoadModule("src/entry-server.ts");

          html = html.replace("<!--ssr-outlet-->", render(req));

          res.write(html);
          res.end();
        });
      },
    }) satisfies Plugin)(),
  ],
});
