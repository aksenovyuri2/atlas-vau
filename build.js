// Сборка: src/template.html + src/data.js + src/land_path.txt → index.html (сайт) и atlas-vau.html (фрагмент для артефакта)
const fs = require('fs');
const path = require('path');
const dir = fs.existsSync(path.join(__dirname,'src')) ? path.join(__dirname,'src') : __dirname;
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const tpl = read('template.html').replace('__DATA__', () => ['data.js','data-more.js','facts.js','photos.js'].filter(f => fs.existsSync(path.join(dir, f))).map(read).join('\n')).replace('__LAND__', () => read('land_path.txt'));
const [head, body] = tpl.split('<!--BODY-->');
const doc = '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="description" content="274 места и события на уровне Антарктиды и выше: фото, факты, даты, цены, риски, карта, календарь и ачивки на октябрь 2026 – декабрь 2027.">\n' + head + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(__dirname, 'index.html'), doc);
fs.writeFileSync(path.join(__dirname, 'atlas-vau.html'), head + body);
console.log('index.html', (doc.length/1024).toFixed(0) + ' KB');
