import type { Connect, PluginOption } from "vite";
import * as fs from "fs/promises";

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

export function ssrPlugin(): PluginOption {
  return {
    name: "lentjs-ssr",
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
          res.setHeader('X-Powered-By', 'LentJS Vite Dev Server');
          res.writeHead(200);

          let html = await fs.readFile("./index.html", { encoding: "utf-8" });
          html = await server.transformIndexHtml(req.url!, html);

          try {
            const { render } = await server.ssrLoadModule("src/entry-server.ts");
            html = html.replace("<!--ssr-outlet-->", render(req));
          }
          catch(e) {
            if (e instanceof Error)
              html = html.replace("<!--ssr-outlet-->", e.toString());
            console.error(e);
          }

          res.write(html);
          res.end();
        }
        catch(e) {
          if (e instanceof Error)
            server.ssrFixStacktrace(e);
          console.error(e);
        }
      });
    },
  };
}
