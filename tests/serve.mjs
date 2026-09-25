// Optional, dependency-free local static server. Never needed on GitHub Pages.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2),
  flag = (name, fallback) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const host = flag("--host", "127.0.0.1"),
  port = Number(flag("--port", "8000"));
const types = {
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json",
};
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    // Exercise exactly the same project-prefix paths GitHub Pages uses.
    const prefix = ["/ragdoll-olympics", "/Ragdoll-SV"].find(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
    if (pathname === prefix) {
      res.writeHead(301, { Location: prefix + "/" });
      res.end();
      return;
    }
    if (prefix) pathname = pathname.slice(prefix.length);
    let file = resolve(root, "." + pathname);
    if (file !== root.slice(0, -1) && !file.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    const content = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}).listen(port, host, () =>
  console.log(`Static game: http://${host}:${port}/`),
);
