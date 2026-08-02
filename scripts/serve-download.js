/**
 * Tiny static server that forces files to DOWNLOAD rather than render inline.
 * Chrome on Android previews application/json in a tab, which is useless when
 * the goal is to get the file into the Downloads folder for the app's
 * "restore from file" picker. Content-Disposition: attachment fixes that.
 *
 *   node scripts/serve-download.js [dir] [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const dir = path.resolve(process.argv[2] || 'backups');
const port = Number(process.argv[3] || 8081);

const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0].replace(/^\/+/, ''));

  if (!name) {
    const files = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<h2 style="font-family:sans-serif">Tap to download</h2>` +
      files.map((f) => `<p style="font-size:1.3rem"><a href="/${encodeURIComponent(f)}">${f}</a></p>`).join('')
    );
    return;
  }

  // Resolve inside dir only — no path traversal.
  const filePath = path.resolve(dir, name);
  if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }

  // .html is served inline (it's a helper page); everything else downloads.
  if (filePath.toLowerCase().endsWith('.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
    'Content-Length': fs.statSync(filePath).size,
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log(`Serving ${dir} (forced download) on port ${port}`);
  for (const ip of ips) console.log(`  http://${ip}:${port}/`);
});
