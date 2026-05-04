/**
 * Baut favicon.png, favicon.ico, favicon.svg und apple-touch-icon.png
 * aus public/brand/prime-realty-logo.png (sharp + to-ico).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = join(root, 'public/brand/prime-realty-logo.png');

async function pngSquare(size) {
	return sharp(brand).resize(size, size).png().toBuffer();
}

const fav16 = await pngSquare(16);
const fav32 = await pngSquare(32);
const fav48 = await pngSquare(48);
const fav180 = await pngSquare(180);

const icoBuf = await toIco([fav16, fav32, fav48]);

writeFileSync(join(root, 'public/favicon.png'), fav32);
writeFileSync(join(root, 'public/apple-touch-icon.png'), fav180);
writeFileSync(join(root, 'public/favicon.ico'), icoBuf);

const b64 = fav32.toString('base64');
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32">
	<image width="32" height="32" href="data:image/png;base64,${b64}" />
</svg>
`;
writeFileSync(join(root, 'public/favicon.svg'), svg);

console.log(
	`OK: favicon.png ${fav32.length}b, favicon.ico ${icoBuf.length}b, apple-touch ${fav180.length}b`,
);
