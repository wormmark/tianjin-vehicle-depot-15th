import { createServer } from 'node:http';
import { constants as fsConstants } from 'node:fs';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile
} from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const root = resolve(process.cwd());
const photosDir = join(root, 'assets', 'photos');
const backupDir = join(photosDir, '_backup');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const maxUploadBytes = 25 * 1024 * 1024;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const safePath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return candidate;
};

const json = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(body));
};

const isLocalRequest = (req) => {
  const address = req.socket.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
};

const isSameOrigin = (req) => {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch (error) {
    return false;
  }
};

const readUploadedSlots = async () => {
  try {
    const source = await readFile(join(photosDir, 'image-slots.js'), 'utf8');
    return new Set(
      [...source.matchAll(/file:\s*['"]([^'"]+)['"]/g)]
        .map((match) => match[1])
        .filter((file) => /^\d{2}-[a-z0-9-]+\.jpg$/i.test(file))
    );
  } catch (error) {
    return new Set();
  }
};

const allowedFiles = await readUploadedSlots();

const backupStamp = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    '-',
    String(now.getMilliseconds()).padStart(3, '0')
  ].join('');
};

const latestBackup = async (file) => {
  try {
    const stem = file.replace(/\.jpg$/i, '');
    const entries = (await readdir(backupDir)).filter((entry) => entry.startsWith(`${stem}-`));
    entries.sort((a, b) => b.localeCompare(a));
    return entries[0] ? join(backupDir, entries[0]) : null;
  } catch (error) {
    return null;
  }
};

const hasBackup = async (file) => Boolean(await latestBackup(file));

const readBody = (req) => new Promise((resolveBody, rejectBody) => {
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (declaredLength > maxUploadBytes) {
    rejectBody(Object.assign(new Error('图片超过 25 MB 限制'), { statusCode: 413 }));
    return;
  }

  const chunks = [];
  let size = 0;
  let rejected = false;
  req.on('data', (chunk) => {
    if (rejected) return;
    size += chunk.length;
    if (size > maxUploadBytes) {
      rejected = true;
      rejectBody(Object.assign(new Error('图片超过 25 MB 限制'), { statusCode: 413 }));
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (!rejected) resolveBody(Buffer.concat(chunks));
  });
  req.on('error', (error) => {
    if (!rejected) rejectBody(error);
  });
});

const validateSlot = (file) => typeof file === 'string' && allowedFiles.has(file);

const replaceImage = async (req, res, file) => {
  if (!isLocalRequest(req)) {
    json(res, 403, { ok: false, message: '素材写入只允许在本机 127.0.0.1 上操作' });
    return;
  }
  if (!isSameOrigin(req)) {
    json(res, 403, { ok: false, message: '请求来源不受信任' });
    return;
  }
  if (!validateSlot(file)) {
    json(res, 400, { ok: false, message: '图片槽位不存在，请刷新替换台后重试' });
    return;
  }
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('image/jpeg')) {
    json(res, 415, { ok: false, message: '浏览器会自动将图片转换为 JPEG，请重新选择图片' });
    return;
  }

  const body = await readBody(req);
  if (body.length < 4 || body[0] !== 0xff || body[1] !== 0xd8 || body[2] !== 0xff) {
    json(res, 415, { ok: false, message: '上传内容不是有效的 JPEG 图片' });
    return;
  }

  const target = join(photosDir, file);
  await mkdir(backupDir, { recursive: true });
  const targetExists = await access(target, fsConstants.F_OK).then(() => true).catch(() => false);
  if (targetExists) {
    await copyFile(target, join(backupDir, `${file.replace(/\.jpg$/i, '')}-${backupStamp()}.jpg`));
  }

  const temporary = join(photosDir, `.${file}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temporary, body);
  await rename(temporary, target);
  const updated = await stat(target);

  json(res, 200, {
    ok: true,
    file,
    bytes: updated.size,
    modifiedAt: updated.mtime.toISOString(),
    message: '图片已写入项目，刷新 H5 即可看到'
  });
};

const restoreImage = async (req, res, file) => {
  if (!isLocalRequest(req)) {
    json(res, 403, { ok: false, message: '素材写入只允许在本机 127.0.0.1 上操作' });
    return;
  }
  if (!isSameOrigin(req)) {
    json(res, 403, { ok: false, message: '请求来源不受信任' });
    return;
  }
  if (!validateSlot(file)) {
    json(res, 400, { ok: false, message: '图片槽位不存在' });
    return;
  }

  const backup = await latestBackup(file);
  if (!backup) {
    json(res, 404, { ok: false, message: '这张图片还没有可还原的备份' });
    return;
  }

  const target = join(photosDir, file);
  await copyFile(backup, target);
  const updated = await stat(target);
  json(res, 200, {
    ok: true,
    file,
    modifiedAt: updated.mtime.toISOString(),
    message: '已还原到最近一次替换前的图片'
  });
};

const imageState = async (req, res) => {
  if (!isLocalRequest(req)) {
    json(res, 403, { ok: false, writeEnabled: false, message: '请在运行服务的电脑上打开替换台' });
    return;
  }

  const files = await Promise.all([...allowedFiles].map(async (file) => {
    const info = await stat(join(photosDir, file)).catch(() => null);
    return {
      file,
      exists: Boolean(info?.isFile()),
      bytes: info?.size || 0,
      modifiedAt: info?.mtime.toISOString() || null,
      hasBackup: await hasBackup(file)
    };
  }));

  json(res, 200, { ok: true, writeEnabled: true, files });
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/image-state' && req.method === 'GET') {
      await imageState(req, res);
      return;
    }
    if (url.pathname === '/api/replace-image' && req.method === 'POST') {
      await replaceImage(req, res, url.searchParams.get('file'));
      return;
    }
    if (url.pathname === '/api/restore-image' && req.method === 'POST') {
      await restoreImage(req, res, url.searchParams.get('file'));
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      json(res, 404, { ok: false, message: '接口不存在' });
      return;
    }

    const filePath = safePath(req.url || '/');
    if (!filePath) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat?.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const content = await readFile(filePath);
    const isPhoto = filePath.startsWith(`${photosDir}${sep}`);
    res.writeHead(200, {
      'Content-Type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': isPhoto ? 'no-store' : 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(content);
  } catch (error) {
    if (!res.headersSent) {
      json(res, error.statusCode || 500, {
        ok: false,
        message: error.statusCode ? error.message : '服务处理失败，请查看终端日志'
      });
    } else {
      res.end();
    }
  }
});

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const openBrowser = (url) => {
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'cmd'
      : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  execFile(command, args, () => {});
};

if (isMainModule) {
  server.listen(port, host, () => {
    const addresses = Object.values(networkInterfaces())
      .flat()
      .filter((entry) => entry?.family === 'IPv4' && !entry.internal)
      .map((entry) => `http://${entry.address}:${port}`);
    const swapUrl = `http://127.0.0.1:${port}/素材替换台.html`;
    console.log(`\n天津车辆段十五周年 H5\n  H5:        http://127.0.0.1:${port}\n  素材替换台: ${swapUrl}\n${addresses.map((address) => `  Network:   ${address}`).join('\n')}\n  图片写入仅限本机 127.0.0.1；局域网地址只用于预览 H5。\n`);
    if (process.env.TJ15_OPEN_BROWSER === '1') openBrowser(swapUrl);
  });
}

export { server };
