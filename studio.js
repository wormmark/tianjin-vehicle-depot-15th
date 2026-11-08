(() => {
  'use strict';

  const slots = window.TJ15_IMAGE_SLOTS || [];
  const configKey = 'tj15.studio.github.config.v1';
  const tokenKey = 'tj15.studio.github.token.v1';
  const apiBase = 'https://api.github.com';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const grid = $('#grid');
  const filters = $('#filters');
  const count = $('#count');
  const toast = $('#toast');
  const form = $('#configForm');
  const configStatus = $('#configStatus');
  const connectionPill = $('#connectionPill');
  const publicLink = $('#publicLink');
  const deployLink = $('#deployLink');
  const disconnect = $('#disconnect');
  const publishHint = $('#publishHint');

  const state = {
    config: { owner: '', repo: '', branch: 'main', publicUrl: '', remember: false },
    token: '',
    connected: false,
    busy: false
  };

  let toastTimer = 0;

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3600);
  };

  const setConfigStatus = (message, tone = '') => {
    configStatus.textContent = message;
    configStatus.classList.remove('is-ok', 'is-error', 'is-busy');
    if (tone) configStatus.classList.add(tone);
  };

  const setPill = (message, tone = '') => {
    connectionPill.textContent = message;
    connectionPill.classList.remove('is-connected', 'is-busy');
    if (tone) connectionPill.classList.add(tone);
  };

  const setConnected = (connected) => {
    state.connected = connected;
    disconnect.disabled = !connected;
    $$('[data-publish]').forEach((button) => { button.disabled = !connected || state.busy; });
    publicLink.href = connected && state.config.publicUrl ? state.config.publicUrl : 'index.html';
    deployLink.hidden = !connected;
    if (connected) {
      deployLink.href = `https://github.com/${encodeURIComponent(state.config.owner)}/${encodeURIComponent(state.config.repo)}/actions`;
    }
  };

  const loadSavedConfig = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(configKey) || '{}');
      state.config = { ...state.config, ...saved };
    } catch {}

    const remember = Boolean(state.config.remember);
    state.token = sessionStorage.getItem(tokenKey) || (remember ? localStorage.getItem(tokenKey) : '') || '';
    form.owner.value = state.config.owner || '';
    form.repo.value = state.config.repo || '';
    form.branch.value = state.config.branch || 'main';
    form.publicUrl.value = state.config.publicUrl || '';
    form.remember.checked = remember;
    form.token.placeholder = state.token ? '已保存 Token；留空沿用，输入可替换' : '粘贴 github_pat_...';
  };

  const persistConfig = () => {
    localStorage.setItem(configKey, JSON.stringify(state.config));
    if (state.config.remember) {
      localStorage.setItem(tokenKey, state.token);
      sessionStorage.setItem(tokenKey, state.token);
    } else {
      localStorage.removeItem(tokenKey);
      sessionStorage.setItem(tokenKey, state.token);
    }
  };

  const clearCredentials = () => {
    localStorage.removeItem(tokenKey);
    sessionStorage.removeItem(tokenKey);
    state.token = '';
    state.connected = false;
    form.token.value = '';
    form.token.placeholder = '粘贴 github_pat_...';
    setConnected(false);
    setPill('未连接');
    setConfigStatus('已断开。仓库信息保留，Token 已从浏览器清除。');
  };

  const repoPath = () => `/repos/${encodeURIComponent(state.config.owner)}/${encodeURIComponent(state.config.repo)}`;

  const github = async (path, options = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${state.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.message || `GitHub 请求失败（${response.status}）`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  };

  const defaultPublicUrl = (owner, repo) => {
    const ownerLower = owner.toLowerCase();
    const repoLower = repo.toLowerCase();
    return repoLower === `${ownerLower}.github.io`
      ? `https://${ownerLower}.github.io/`
      : `https://${ownerLower}.github.io/${repo}/`;
  };

  const normalizePublicUrl = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    try {
      const url = new URL(trimmed);
      if (!/^https?:$/.test(url.protocol)) return '';
      return url.href.endsWith('/') ? url.href : `${url.href}/`;
    } catch {
      return '';
    }
  };

  const friendlyGithubError = (error) => {
    if (error.status === 401) return 'Token 无效或已过期，请重新生成后连接。';
    if (error.status === 403) return 'Token 没有写入权限，或 GitHub 暂时限制了请求。请确认 Contents 权限为 Read and write。';
    if (error.status === 404) return '仓库或分支不存在，或 Token 没有该仓库的访问权限。';
    if (error.status === 409) return '文件在远端已被修改，请稍后重试。';
    return error.message || 'GitHub 请求失败。';
  };

  const connect = async ({ silent = false } = {}) => {
    if (state.busy) return;
    const owner = form.owner.value.trim();
    const repo = form.repo.value.trim();
    const branch = form.branch.value.trim() || 'main';
    const tokenInput = form.token.value.trim();
    const token = tokenInput || state.token;
    const manualUrl = normalizePublicUrl(form.publicUrl.value);

    if (!owner || !repo) {
      setConfigStatus('请填写 GitHub 仓库所有者与仓库名称。', 'is-error');
      return;
    }
    if (!token) {
      setConfigStatus('请粘贴 GitHub Token。', 'is-error');
      return;
    }

    state.config = {
      owner,
      repo,
      branch,
      publicUrl: manualUrl || defaultPublicUrl(owner, repo),
      remember: form.remember.checked
    };
    state.token = token;
    state.busy = true;
    form.querySelector('[type="submit"]').disabled = true;
    setPill('正在验证', 'is-busy');
    setConfigStatus('正在验证仓库、分支与 Token 权限…', 'is-busy');

    try {
      const repository = await github(repoPath());
      await github(`${repoPath()}/branches/${encodeURIComponent(branch)}`);
      state.busy = false;
      state.config.publicUrl = manualUrl || defaultPublicUrl(owner, repo);
      form.publicUrl.value = state.config.publicUrl;
      form.token.value = '';
      form.token.placeholder = '已保存 Token；留空沿用，输入可替换';
      persistConfig();
      setConnected(true);
      setPill('已连接', 'is-connected');
      const privateNote = repository.private ? ' 该仓库为私有；若使用 GitHub Pages，需要公开仓库或符合当前账户的 Pages 条件。' : '';
      setConfigStatus(`已连接 ${owner}/${repo} · ${branch}。图片提交后将触发重新发布。${privateNote}`, 'is-ok');
      publishHint.textContent = '已连接。选择照片即提交到仓库；发布完成后，同一公开网址更新，无需重新生成链接。';
      if (!silent) showToast('仓库连接成功，可以上传图片了');
    } catch (error) {
      state.busy = false;
      state.connected = false;
      setConnected(false);
      setPill('连接失败');
      setConfigStatus(friendlyGithubError(error), 'is-error');
    } finally {
      form.querySelector('[type="submit"]').disabled = false;
    }
  };

  const chapters = ['全部', ...new Set(slots.map((slot) => slot.chapter))];

  filters.innerHTML = chapters.map((chapter) => `
    <button class="studio-filter" type="button" aria-pressed="${chapter === '全部'}" data-filter="${escapeHtml(chapter)}">${escapeHtml(chapter)}</button>
  `).join('');

  grid.innerHTML = slots.map((slot, index) => `
    <article class="studio-card" data-chapter="${escapeHtml(slot.chapter)}" data-file="${escapeHtml(slot.file)}">
      <div class="studio-card__media">
        <img src="assets/photos/${escapeHtml(slot.file)}" alt="${escapeHtml(slot.title)} 当前图片" loading="lazy" decoding="async" data-image>
        <span class="studio-card__num">${String(index + 1).padStart(2, '0')}</span>
      </div>
      <div class="studio-card__body">
        <span class="studio-card__chapter">${escapeHtml(slot.chapter)} · ${escapeHtml(slot.title)}</span>
        <h2>${escapeHtml(slot.usage)}</h2>
        <p class="studio-card__usage">${escapeHtml(slot.size)} · 固定文件名</p>
        <p class="studio-card__note">${escapeHtml(slot.note)}</p>
        <div class="studio-card__meta"><span>JPG / PNG / WebP</span><span>.jpg</span></div>
        <div class="studio-card__file"><code>assets/photos/${escapeHtml(slot.file)}</code></div>
        <div class="studio-card__actions">
          <button class="studio-card__publish" type="button" data-publish disabled>上传并发布</button>
          <span class="studio-card__state" data-state>等待连接仓库</span>
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" data-input hidden>
      </div>
    </article>
  `).join('');

  const applyFilter = (chapter) => {
    let visible = 0;
    $$('.studio-card').forEach((card) => {
      const show = chapter === '全部' || card.dataset.chapter === chapter;
      card.hidden = !show;
      if (show) visible += 1;
    });
    $$('.studio-filter').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === chapter));
    });
    count.textContent = chapter === '全部' ? `共 ${slots.length} 张图片` : `${chapter} · ${visible} 张图片`;
  };

  const decodeImage = async (file) => {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
      } catch {}
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('浏览器无法读取这张图片，请改用 JPG、PNG 或 WebP'));
    });
    image.src = objectUrl;
    try {
      await loaded;
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(objectUrl) };
  };

  const prepareJpeg = async (file) => {
    if (!file?.size) throw new Error('没有读取到图片文件');
    if (file.size > 40 * 1024 * 1024) throw new Error('原图超过 40 MB，请压缩后重试');
    const imageLike = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!imageLike) throw new Error('请选择 JPG、PNG 或 WebP 图片');

    const decoded = await decodeImage(file);
    try {
      if (!decoded.width || !decoded.height) throw new Error('图片尺寸异常');
      const maxEdge = 2400;
      const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('浏览器无法处理这张图片');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.fillStyle = '#08090a';
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.image, 0, 0, width, height);

      let blob = null;
      for (const quality of [0.9, 0.82, 0.72]) {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= 2.5 * 1024 * 1024) break;
      }
      if (!blob) throw new Error('图片转换失败，请换一张图片重试');
      return blob;
    } finally {
      decoded.close();
    }
  };

  const blobToBase64 = async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  };

  const fileApiPath = (file) => `${repoPath()}/contents/${file.split('/').map(encodeURIComponent).join('/')}`;

  const getRemoteFile = async (path) => {
    try {
      return await github(`${fileApiPath(path)}?ref=${encodeURIComponent(state.config.branch)}`);
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  };

  const commitImage = async (path, base64, message, retry = true) => {
    const existing = await getRemoteFile(path);
    const body = {
      message,
      content: base64,
      branch: state.config.branch,
      ...(existing?.sha ? { sha: existing.sha } : {})
    };
    try {
      return await github(fileApiPath(path), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (error) {
      if (error.status === 409 && retry) return commitImage(path, base64, message, false);
      throw error;
    }
  };

  const setCardState = (card, html) => {
    const element = card.querySelector('[data-state]');
    if (element) element.innerHTML = html;
  };

  const publishSlot = async (card, file) => {
    if (!state.connected || state.busy) {
      showToast('请先连接 GitHub 仓库');
      return;
    }
    const slotFile = card.dataset.file;
    const image = card.querySelector('[data-image]');
    const publish = card.querySelector('[data-publish]');
    state.busy = true;
    setConnected(true);
    publish.disabled = true;
    card.classList.add('is-publishing');
    setCardState(card, '正在压缩图片…');

    try {
      const jpeg = await prepareJpeg(file);
      setCardState(card, '正在读取远端文件…');
      const base64 = await blobToBase64(jpeg);
      setCardState(card, '正在提交到 GitHub…');
      const result = await commitImage(
        `assets/photos/${slotFile}`,
        base64,
        `chore(images): 更新 ${slotFile}`
      );
      const previewUrl = URL.createObjectURL(jpeg);
      image.src = previewUrl;
      const commitUrl = /^https:\/\/github\.com\//.test(result?.commit?.html_url || '') ? result.commit.html_url : '';
      setCardState(card, commitUrl
        ? `已提交 · <a href="${escapeHtml(commitUrl)}" target="_blank" rel="noopener">查看提交</a>`
        : '已提交，等待部署');
      if (commitUrl) deployLink.href = commitUrl;
      showToast('图片已提交。托管平台重新发布后，同一公开网址会自动显示新图。');
    } catch (error) {
      setCardState(card, '发布失败');
      showToast(friendlyGithubError(error));
    } finally {
      state.busy = false;
      card.classList.remove('is-publishing');
      setConnected(true);
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    connect();
  });

  disconnect.addEventListener('click', clearCredentials);

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (button) applyFilter(button.dataset.filter);
  });

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-publish]');
    if (!button) return;
    button.closest('.studio-card')?.querySelector('[data-input]')?.click();
  });

  grid.addEventListener('change', (event) => {
    const input = event.target.closest('[data-input]');
    if (!input) return;
    const card = input.closest('.studio-card');
    const file = input.files?.[0];
    input.value = '';
    if (card && file) publishSlot(card, file);
  });

  window.addEventListener('beforeunload', (event) => {
    if (!state.busy) return;
    event.preventDefault();
    event.returnValue = '';
  });

  loadSavedConfig();
  applyFilter('全部');
  setConnected(false);

  if (state.config.owner && state.config.repo && state.token) {
    connect({ silent: true });
  } else {
    setConnected(false);
  }
})();
