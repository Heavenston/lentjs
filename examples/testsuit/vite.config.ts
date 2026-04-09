import { type Plugin, defineConfig, type Connect } from 'vite'
import * as fs from "fs/promises";
import LentJS from "@lentjs/vitejs-plugin";

const shouldSsrRender = (req: Connect.IncomingMessage) => {
  const pathname = req.url ?? "";
  if (/\.[\w?=&]+$/.test(pathname) && !pathname.endsWith('.html')) {
    // has extension
    return false;
  }
  if (pathname.includes('_-vite-ping')) {
    return false;
  }
  if (pathname.includes('__open-in-editor')) {
    return false;
  }
  if (pathname.includes('?editor:')) {
    return false;
  }
  // if (url.searchParams.has('html-proxy')) {
  //   return false;
  // }
  // if (url.searchParams.get('ssr') === 'false') {
  //   return false;
  // }
  if (pathname.includes('@builder.io/qwik/build')) {
    return false;
  }
  if (pathname.includes('@vite')) {
    return false;
  }
  const acceptHeader = req.headers.accept || '';
  const accepts = acceptHeader.split(',').map((accept) => accept.split(';')[0]);
  if (accepts.length == 1 && accepts.includes('*/*')) {
    // special case for curl where the default is `*/*` with no additional headers
    return true;
  }

  if (!accepts.includes('text/html')) {
    return false;
  }
  return true;
};

export default defineConfig({
  server: {
    port: 1234,
  },

  oxc: false,

  plugins: [
    LentJS(),
    (() => ({
      name: "lent-id",
      transform: {
        filter: {
          code: /____RANDOM_ID/,
        },
        async handler(code, id) {
          const pref = new BigUint64Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(id)))[0].toString(36).replace(/[/=]/g, "");
          const d = new Uint16Array(await crypto.subtle.digest("SHA-512", Uint8Array.from(code)));
          const usedIds = new Set<number>;
          let i = 0;

          function newId() {
            if (i+1 >= d.length) throw new Error("Ran out of ids");
            const id = d[i++];
            if (usedIds.has(id)) return newId;
            usedIds.add(id);
            return id;
          }

          return {
            code: code.replace(/____RANDOM_ID/g, () => `${pref}_${newId().toString(16).padStart(4, "0")}`),
          };
        },
      },
    }) satisfies Plugin)(),
    (() => ({
      name: "lent-ssr",
      enforce: "pre",

      configureServer: (server) => {
        server.middlewares.use(async (req, res, next) => {
          if (!shouldSsrRender(req))
            return next();

          try {
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
          }
          catch(e) {
            server.ssrFixStacktrace(e);
            console.error(e);
          }
        });
      },
    }) satisfies Plugin)(),
  ],
});
