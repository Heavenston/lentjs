import { type PluginOption } from "vite";

export function randomIdPlugin(): PluginOption {
  return {
    name: "lentjs-vitejs-random-id",
    transform: {
      filter: {
        code: /____RANDOM_ID/,
      },
      async handler(code, id) {
        function toBase64(arr: Uint8Array): string {
          // @ts-expect-error toBase64 only available very recently
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return arr.toBase64();
        }
        const prefix = toBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(`${id}\n${code}`)))).replace(/[+/=]/g, "").slice(0,16);
        let i = 0;
        const newId = () => i++;
        return {
          code: code.replace(/____RANDOM_ID/g, () => `${prefix}_${newId().toString(16).padStart(2, "0")}`),
        };
      },
    },
  };
}

