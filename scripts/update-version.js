const fs = require('fs');
const v = process.argv[2];
if (!v) { console.error('Usage: node update-version.js <version>'); process.exit(1); }

const pj = JSON.parse(fs.readFileSync('package.json'));
pj.version = v;
fs.writeFileSync('package.json', JSON.stringify(pj, null, 2));

let em = fs.readFileSync('electron-main.js', 'utf8');
em = em.replace(/const APP_VERSION = .+/, `const APP_VERSION = '${v}';`);
fs.writeFileSync('electron-main.js', em);

let ih = fs.readFileSync('index.html', 'utf8');
ih = ih.replace(/v[0-9]+\.[0-9]+\.[0-9]+<\/span>/, `v${v}</span>`);
fs.writeFileSync('index.html', ih);

console.log('Version updated to', v);
