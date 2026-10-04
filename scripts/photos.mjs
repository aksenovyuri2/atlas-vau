// Подбор 2–3 фото на каждое место из статей английской Википедии (снимки с Wikimedia Commons).
// Запуск: node scripts/photos.mjs  → src/photos.js
import fs from 'fs';

const TITLES = JSON.parse(fs.readFileSync(new URL('./wiki-titles.json', import.meta.url), 'utf8'));
const OUT = new URL('../src/photos.js', import.meta.url);
const UA = 'atlas-vau/1.0 (https://github.com/aksenovyuri2/atlas-vau)';
const API = 'https://en.wikipedia.org/api/rest_v1/page/';
const SKIP = /(map|flag|logo|emblem|coat[_ ]of[_ ]arms|locator|location|diagram|chart|graph|icon|seal[_ ]of|symbol|signature|banner|blank|outline|stamp|coin|banknote|relief|topograph|orthographic|globe|wikimedia|commons-logo|question_book|edit-clear|ambox|crystal_clear|nuvola|wiktionary|wikiquote|wikisource|wikivoyage|portal|disambig|padlock|speaker|sound|audio|portrait|painting|engraving|drawing|illustration|lithograph|sketch|scale|comparison|size_|skull|fossil|distribution|range_map|cartoon|poster|document|letter|crest|giovio|plate_|fig\.|figure|herbarium|specimen|ipomoea|\.svg|\.gif|\.webm|\.ogv|\.ogg|\.mp3|\.tif)/i;
const OKPNG = /(Tolbachik_Kamchatka_from|Tolbachik_volcano_1975|Golondrinas_Entrance|Api_Chamber|Abandonded_house_in_Kolmanskop|Climber_on_the_summit|Plymouth_Street_Lamp|Buddhist-Temple-Iturup|Paradise_harbor|Asmara_Montage|Hadza_montage|Richat_structure_cropped|Socotra_Island|ISS00)/i;
const isBadPng = f => /\.(png|webp)$/i.test(f) && !OKPNG.test(f);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, tries = 3){
  for (let i = 0; i < tries; i++){
    try {
      const r = await fetch(url, {headers: {'User-Agent': UA, 'Api-User-Agent': UA}});
      if (r.status === 404) return null;
      if (r.status === 429 || r.status >= 500){ await sleep(1500 * (i + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch (e){ await sleep(1000 * (i + 1)); }
  }
  return null;
}
const https = u => (u.startsWith('//') ? 'https:' + u : u).replace(/\?.*$/, '');
const fileOf = u => { const m = https(u).match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/); return m ? decodeURIComponent(m[1]) : null; };
const sized = (u, w) => https(u).replace(/\/\d+px-/, '/' + w + 'px-');

async function photosFor(titles, prev = []){
  const out = prev.slice(), seen = new Set(prev.map(p => decodeURIComponent(p.f.split('File:')[1] || '').replace(/_/g, ' ')));
  const add = (file, small, large, caption) => {
    if (file) file = file.replace(/_/g, ' ');
    if (!file || seen.has(file) || SKIP.test(file) || isBadPng(file) || out.length >= 3) return;
    seen.add(file);
    out.push({s: small, l: large, f: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_')), c: caption || ''});
  };
  for (const t of titles){
    const slug = encodeURIComponent(t.replace(/ /g, '_'));
    const sum = await get(API + 'summary/' + slug);
    if (sum && sum.thumbnail){
      const file = fileOf(sum.originalimage ? sum.originalimage.source : sum.thumbnail.source);
      const ow = sum.originalimage ? sum.originalimage.width : sum.thumbnail.width;
      const isThumb = /\/thumb\//.test(sum.thumbnail.source);
      const small = isThumb ? (ow >= 500 ? sized(sum.thumbnail.source, 500) : https(sum.originalimage.source)) : https(sum.thumbnail.source);
      const large = isThumb ? (ow >= 1280 ? sized(sum.thumbnail.source, 1280) : ow >= 960 ? sized(sum.thumbnail.source, 960) : small) : small;
      add(file, small, large, sum.title);
    }
    if (out.length >= 3) break;
    const ml = await get(API + 'media-list/' + slug);
    if (ml && ml.items){
      const items = ml.items.slice().sort((a, b) => (/\.jpe?g$/i.test(b.title || '') ? 1 : 0) - (/\.jpe?g$/i.test(a.title || '') ? 1 : 0));
      for (const it of items){
        if (it.type !== 'image' || !it.srcset || !it.srcset.length) continue;
        const file = (it.title || '').replace(/^File:/, '');
        const src = it.srcset[0].src;
        const big = it.srcset[it.srcset.length - 1].src;
        const small = https(src);
        const large = /\/500px-/.test(small) ? sized(src, 960) : https(big);
        add(file, small, large, (it.caption && it.caption.text) || t);
        if (out.length >= 3) break;
      }
    }
    if (out.length >= 3) break;
    await sleep(RETRY ? 600 : 150);
  }
  return out;
}

const ids = Object.keys(TITLES);
const RETRY = !!process.env.RETRY;
let PREV = {};
if (RETRY && fs.existsSync(OUT)){ const src = fs.readFileSync(OUT, 'utf8'); PREV = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  for (const k in PREV) PREV[k] = PREV[k].filter(p => { const f = decodeURIComponent(p.f.split('File:')[1] || ''); return !SKIP.test(f) && !isBadPng(f) && !(process.env.RESET || '').split(',').includes(k); }); }
const result = Object.assign({}, PREV);
let done = 0;
const queue = RETRY ? ids.filter(id => !PREV[id] || PREV[id].length < 3) : ids.slice();
console.log('to fetch', queue.length);
async function worker(){
  while (queue.length){
    const id = queue.shift();
    result[id] = await photosFor(TITLES[id], RETRY ? (PREV[id] || []) : []);
    if (RETRY) await sleep(800);
    done++;
    if (done % 25 === 0) console.log(done + '/' + ids.length);
  }
}
await Promise.all(RETRY ? [worker()] : [worker(), worker(), worker()]);
const ordered = Object.fromEntries(ids.map(id => [id, result[id]]));
fs.writeFileSync(OUT, '// Фото: Wikimedia Commons через статьи английской Википедии. Сгенерировано scripts/photos.mjs\nconst PHOTOS = ' + JSON.stringify(ordered, null, 0).replace(/\],"/g, '],\n"') + ';\n');
const counts = ids.map(id => ordered[id].length);
console.log('places', ids.length, 'with 3:', counts.filter(n => n >= 3).length, 'with 2:', counts.filter(n => n === 2).length, 'with 1:', counts.filter(n => n === 1).length, 'with 0:', counts.filter(n => n === 0).length);
console.log('zero:', ids.filter(id => !ordered[id].length).join(', '));
console.log('one:', ids.filter(id => ordered[id].length === 1).join(', '));
