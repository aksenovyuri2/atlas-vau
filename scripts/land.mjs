// Контуры суши Natural Earth 1:110m → SVG-путь в равнопромежуточной проекции 1000×500 (с корректным разрезом по 180-му меридиану)
import fs from 'fs';
import {geoEquirectangular, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
const topo = JSON.parse(fs.readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)));
const land = feature(topo, topo.objects.land);
const proj = geoEquirectangular().scale(1000 / (2 * Math.PI)).translate([500, 250]).precision(0.2);
const d = geoPath(proj).digits(1)(land);
fs.writeFileSync(new URL('../src/land_path.txt', import.meta.url), d);
console.log('path length', d.length);
