const http = require('http');
const fs = require('fs');
const path = require('path');
const root = 'E:/IanMusic';
const server = http.createServer((req, res) => {
    let fp = path.join(root, req.url.split('?')[0]);
    if (fp.endsWith('/')) fp += 'index.html';
    if (!fs.existsSync(fp)) { res.writeHead(404); return res.end('Not Found'); }
    const ext = path.extname(fp).toLowerCase();
    const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript',
        '.json':'application/json','.png':'image/png','.jpg':'image/jpeg',
        '.svg':'image/svg+xml','.flac':'audio/flac','.mp3':'audio/mpeg',
        '.wav':'audio/wav','.ico':'image/x-icon'};
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(fp).pipe(res);
});
server.listen(8090, () => console.log('Server running on http://localhost:8090'));
