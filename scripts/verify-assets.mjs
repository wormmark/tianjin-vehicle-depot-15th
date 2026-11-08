import { access, readFile, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const photosDir = join(root, 'assets', 'photos');
const slotSource = await readFile(join(photosDir, 'image-slots.js'), 'utf8');
const sandbox = { window: {} };
runInNewContext(slotSource, sandbox, { filename: 'image-slots.js' });
const slots = sandbox.window.TJ15_IMAGE_SLOTS || [];

const errors = [];
const warnings = [];
const slotFiles = new Set(slots.map((slot) => slot.file));

if (slots.length !== 23) errors.push(`图片槽位应为 23 个，实际为 ${slots.length} 个`);
if (slotFiles.size !== slots.length) errors.push('图片槽位存在重复文件名');

for (const slot of slots) {
  if (!/^\d{2}-[a-z0-9-]+\.jpg$/.test(slot.file)) {
    errors.push(`文件名不符合编号槽位规则：${slot.file}`);
  }
  const info = await stat(join(photosDir, slot.file)).catch(() => null);
  if (!info?.isFile()) errors.push(`槽位文件缺失：${slot.file}`);
  for (const field of ['chapter', 'title', 'usage', 'size', 'note']) {
    if (!slot[field]) errors.push(`${slot.file} 缺少说明字段：${field}`);
  }
}

const sourceFiles = ['index.html', 'styles.css', 'app.js', 'data.js', 'studio.html', 'studio.css', 'studio.js', '素材替换台.html'];
const referenced = new Set();
for (const file of sourceFiles) {
  const source = await readFile(join(root, file), 'utf8');
  for (const match of source.matchAll(/assets\/photos\/([A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp))/g)) {
    const name = match[1];
    referenced.add(name);
    if (!slotFiles.has(name)) errors.push(`${file} 引用了清单外的图片：${name}`);
  }
}

for (const slot of slots) {
  if (!referenced.has(slot.file)) warnings.push(`槽位未在页面代码中发现直接引用：${slot.file}`);
}

const html = await readFile(join(root, 'index.html'), 'utf8');
if (!html.includes('23-share-cover.jpg')) errors.push('index.html 未使用 23-share-cover.jpg 作为分享封面');
if (html.includes('og-cover.jpg')) errors.push('index.html 仍残留旧分享封面 og-cover.jpg');

for (const file of ['studio.html', 'studio.css', 'studio.js', '.github/workflows/deploy.yml']) {
  const info = await stat(join(root, file)).catch(() => null);
  if (!info?.isFile()) errors.push(`公网发布文件缺失：${file}`);
}

const workflow = await readFile(join(root, '.github', 'workflows', 'deploy.yml'), 'utf8').catch(() => '');
for (const required of ['branches: [main]', 'npm run build', 'actions/upload-pages-artifact', 'actions/deploy-pages', 'pages: write', 'id-token: write']) {
  if (!workflow.includes(required)) errors.push(`GitHub Pages 工作流缺少：${required}`);
}

const dist = join(root, 'dist');
const hasDist = await access(join(dist, 'index.html')).then(() => true).catch(() => false);
if (hasDist) {
  for (const slot of slots) {
    const info = await stat(join(dist, 'assets', 'photos', slot.file)).catch(() => null);
    if (!info?.isFile()) errors.push(`公开构建缺少图片：${slot.file}`);
  }
  for (const file of ['index.html', 'styles.css', 'app.js', 'data.js', 'studio.html', 'studio.css', 'studio.js', '.nojekyll', '404.html']) {
    const info = await stat(join(dist, file)).catch(() => null);
    if (!info?.isFile()) errors.push(`公开构建缺少文件：${file}`);
  }
  for (const forbidden of ['server.mjs', '素材替换台.html', 'assets/photos/_backup']) {
    const info = await stat(join(dist, forbidden)).catch(() => null);
    if (info) errors.push(`公开构建不应包含：${forbidden}`);
  }
  const publicHtml = await readFile(join(dist, 'index.html'), 'utf8');
  if (!/assets\/photos\/01-hero-main\.jpg\?v=/.test(publicHtml)) errors.push('公开构建未给首屏图片附加缓存版本号');
}

if (errors.length) {
  console.error(`素材校验失败：${errors.length} 个问题`);
  errors.forEach((error) => console.error(`  ✗ ${error}`));
  process.exitCode = 1;
} else {
  console.log(`素材校验通过：${slots.length} 个图片槽位、${referenced.size} 个页面引用全部一致${hasDist ? '，公开构建完整' : ''}。`);
}

if (warnings.length) {
  warnings.forEach((warning) => console.warn(`  ! ${warning}`));
}
