const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

http.createServer((request, response) => {
  const pathname = request.url.split("?")[0];
  const urlPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(root, decodeURIComponent(urlPath));

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(contents);
  });
}).listen(port, () => {
  console.log(`Watchers: http://localhost:${port}`);
});
