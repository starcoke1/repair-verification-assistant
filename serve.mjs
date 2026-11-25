import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("./web/", import.meta.url);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8"
};

async function serve(request, response) {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const path = new URL(request.url, "http://localhost").pathname;
  const name = path === "/" ? "index.html" : path.slice(1);
  const type = contentTypes[extname(name)];
  if (!type || basename(name) !== name || !/^[a-z][a-z0-9.-]+$/.test(name)) {
    response.writeHead(404).end("Page not found.");
    return;
  }
  try {
    const content = await readFile(new URL(name, root));
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    const missing = error.code === "ENOENT";
    response.writeHead(missing ? 404 : 500).end(missing ? "Page not found." : "Could not read page.");
  }
}

export async function startServer(port = 0) {
  const server = createServer(serve);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    url: "http://127.0.0.1:" + server.address().port + "/",
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const server = await startServer(Number(process.env.PORT ?? 4173));
    console.log("Local: " + server.url);
  } catch (error) {
    console.error("Could not start the preview: " + error.message);
    process.exitCode = 1;
  }
}
