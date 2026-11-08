import { createHash } from 'node:crypto';
import { readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PassThrough } from 'node:stream';
import { server } from '../server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const photosDir = join(root, 'assets', 'photos');
const backupDir = join(photosDir, '_backup');
const testFile = '01-hero-main.jpg';
const testPath = join(photosDir, testFile);
const original = await readFile(testPath);
const originalStat = await stat(testPath);
const originalHash = createHash('sha256').update(original).digest('hex');
const backupExisted = await stat(backupDir).then((info) => info.isDirectory()).catch(() => false);
const backupsBefore = backupExisted ? new Set(await readdir(backupDir)) : new Set();

const request = ({ method = 'GET', url = '/', headers = {}, body = null, remoteAddress = '127.0.0.1' }) => (
  new Promise((resolveResponse, rejectResponse) => {
    const req = new PassThrough();
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    req.socket = { remoteAddress };
    if (body) req.headers['content-length'] = String(body.length);

    const timer = setTimeout(() => rejectResponse(new Error(`请求超时：${url}`)), 3000);
    const res = {
      headersSent: false,
      writeHead(status, responseHeaders = {}) {
        this.statusCode = status;
        this.headers = responseHeaders;
        this.headersSent = true;
        return this;
      },
      end(payload = Buffer.alloc(0)) {
        clearTimeout(timer);
        const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
        let parsed = null;
        try { parsed = JSON.parse(buffer.toString('utf8')); } catch {}
        resolveResponse({ status: this.statusCode, headers: this.headers, body: buffer, json: parsed });
      }
    };

    server.emit('request', req, res);
    req.end(body || undefined);
  })
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  const state = await request({ url: '/api/image-state' });
  assert(state.status === 200 && state.json?.writeEnabled, '本机图片状态接口未启用');
  assert(state.json.files?.length === 23, '图片状态接口未返回 23 个槽位');

  const photoResponse = await request({ url: `/assets/photos/${testFile}` });
  assert(photoResponse.status === 200, 'H5 图片静态响应失败');
  assert(photoResponse.headers?.['Cache-Control'] === 'no-store', 'H5 图片未设置为每次重新读取');

  const forbidden = await request({
    method: 'POST',
    url: `/api/replace-image?file=${encodeURIComponent(testFile)}`,
    headers: { 'Content-Type': 'image/jpeg' },
    body: original,
    remoteAddress: '192.168.1.20'
  });
  assert(forbidden.status === 403, '非本机写入请求未被拒绝');

  const badSlot = await request({
    method: 'POST',
    url: '/api/replace-image?file=../../package.json',
    headers: { 'Content-Type': 'image/jpeg' },
    body: original
  });
  assert(badSlot.status === 400, '非法图片槽位未被拒绝');

  const replaced = await request({
    method: 'POST',
    url: `/api/replace-image?file=${encodeURIComponent(testFile)}`,
    headers: { 'Content-Type': 'image/jpeg' },
    body: original
  });
  assert(replaced.status === 200 && replaced.json?.ok, `上传接口失败：${replaced.json?.message || replaced.status}`);

  const afterUpload = await readFile(testPath);
  const uploadedHash = createHash('sha256').update(afterUpload).digest('hex');
  assert(uploadedHash === originalHash, '上传后的图片内容与原始测试图片不一致');

  const backupsAfterUpload = await readdir(backupDir);
  assert(backupsAfterUpload.length > backupsBefore.size, '上传前没有生成原图备份');

  const restored = await request({
    method: 'POST',
    url: `/api/restore-image?file=${encodeURIComponent(testFile)}`,
    headers: {}
  });
  assert(restored.status === 200 && restored.json?.ok, `还原接口失败：${restored.json?.message || restored.status}`);

  const afterRestore = await readFile(testPath);
  const restoredHash = createHash('sha256').update(afterRestore).digest('hex');
  assert(restoredHash === originalHash, '还原后的图片内容不正确');

  console.log('图片写入接口测试通过：状态查询、本机限制、路径校验、上传备份、文件写入与还原均正常。');
} finally {
  await writeFile(testPath, original);
  await utimes(testPath, originalStat.atime, originalStat.mtime);
  if (!backupExisted) {
    await rm(backupDir, { recursive: true, force: true });
  } else {
    const backupsAfter = await readdir(backupDir).catch(() => []);
    for (const entry of backupsAfter) {
      if (!backupsBefore.has(entry)) await rm(join(backupDir, entry), { force: true });
    }
  }
}
