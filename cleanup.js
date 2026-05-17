const fs = require('fs');
const f = 'E:\\\\IanMusic\\\\index.html';
let c = fs.readFileSync(f, 'utf8');
// Remove all orphaned garbage path data that appears after </button> but before the next proper button
c = c.replace(/<\/svg><\/button>[\s\S]*?(?=<\/svg><\/button>\s*\n\s*<\/div>|<div class="volume-section")/g, '</svg></button>');
fs.writeFileSync(f, c, 'utf8');
console.log('Done. File cleaned.');
