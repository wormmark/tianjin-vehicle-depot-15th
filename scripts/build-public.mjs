import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const photosDir = join(root, 'assets', 'photos');
const assetVersion = String(process.env.ASSET_VERSION || process.env.GITHUB_SHA || process.env.COMMIT_REF || Date.now()).slice(0, 16);

const copy = async (from, to = from) => {
  await mkdir(dirname(join(dist, to)), { recursive: true });
  await cp(join(root, from), join(dist, to), { recursive: true });
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ['index.html', 'styles.css', 'app.js', 'data.js', 'studio.html', 'studio.css', 'studio.js']) {
  await copy(file);
}

for (const file of ['index.html', 'styles.css', 'app.js', 'data.js']) {
  const target = join(dist, file);
  const source = await readFile(target, 'utf8');
  const versioned = source.replace(/assets\/photos\/(\d{2}-[a-z0-9-]+\.jpg)(?!\?v=)/gi, `assets/photos/$1?v=${assetVersion}`);
  await writeFile(target, versioned);
}

await copy('assets/fonts');
await copy('assets/grain.svg');
await mkdir(join(dist, 'assets', 'photos'), { recursive: true });

const slotSource = await readFile(join(photosDir, 'image-slots.js'), 'utf8');
const slotFiles = [...slotSource.matchAll(/file:\s*['"]([^'"]+)['"]/g)]
  .map((match) => match[1])
  .filter((file) => /^\d{2}-[a-z0-9-]+\.jpg$/i.test(file));

for (const file of slotFiles) {
  await cp(join(photosDir, file), join(dist, 'assets', 'photos', file));
}
await copy('assets/photos/image-slots.js', 'assets/photos/image-slots.js');

const publicUrl = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
let html = await readFile(join(dist, 'index.html'), 'utf8');
if (publicUrl) {
  html = html
    .replaceAll('assets/photos/23-share-cover.jpg', `${publicUrl}/assets/photos/23-share-cover.jpg`)
    .replace('</head>', `  <link rel="canonical" href="${publicUrl}/">\n  <meta property="og:url" content="${publicUrl}/">\n</head>`);
}
await writeFile(join(dist, 'index.html'), html);

await writeFile(join(dist, '.nojekyll'), '');
await writeFile(join(dist, '404.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./"><title>返回纪念册</title><body style="background:#070809;color:#eee;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0"><a style="color:#cda56b" href="./">返回《十五载砺剑·一路向前》</a></body></html>`);

const files = await readdir(join(dist, 'assets', 'photos'));
const totalBytes = (await Promise.all(files.map(async (file) => (await stat(join(dist, 'assets', 'photos', file))).size)))
  .reduce((sum, size) => sum + size, 0);

console.log(`公开站点已生成：${dist}`);
console.log(`图片槽位：${slotFiles.length} 张，照片总计约 ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`图片版本：${assetVersion}`);
console.log(publicUrl ? `公开地址写入：${publicUrl}/` : '未设置 PUBLIC_URL，分享图使用相对路径。');
