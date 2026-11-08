/* 天津车辆段建段十五周年 · 移动端互动影像志 */
(() => {
  'use strict';

  const data = window.TJ15 || { timeline: [], development: [], hotspots: [], duty: [] };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const pad = (value) => String(value).padStart(2, '0');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const body = document.body;
  const preloader = $('#preloader');
  const chapterMenu = $('#chapterMenu');
  const detailSheet = $('#detailSheet');
  const sheetContent = $('#sheetContent');
  const lightbox = $('#lightbox');
  const lightboxImage = $('#lightboxImage');
  const lightboxCaption = $('#lightboxCaption');
  const shareDialog = $('#shareDialog');
  const toast = $('#toast');
  const messageInput = $('#messageInput');
  const messageCount = $('#messageCount');
  const messageStatus = $('#messageStatus');
  const messageForm = $('#messageForm');
  const storageKey = 'tj15.message.local.v1';
  const focusReturn = new WeakMap();

  /* Preloader and hero entrance */
  const splitHeroTitle = () => {
    $$('[data-split]').forEach((line) => {
      const original = line.textContent.trim();
      line.innerHTML = Array.from(original).map((char, index) => (
        `<span class="char" style="--char-index:${index}">${escapeHtml(char)}</span>`
      )).join('');
    });
  };

  let hasEntered = false;
  const enterFilm = () => {
    if (hasEntered) return;
    hasEntered = true;
    preloader?.classList.add('is-hidden');
    body.classList.add('is-ready');
    window.setTimeout(() => preloader?.setAttribute('aria-hidden', 'true'), 1200);
  };

  splitHeroTitle();
  window.setTimeout(enterFilm, reduceMotion ? 200 : 1550);
  window.addEventListener('load', enterFilm, { once: true });

  /* Toast */
  let toastTimer = 0;
  const showToast = (message) => {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => { toast.hidden = true; }, 320);
    }, 2600);
  };

  /* Clipboard */
  const copyText = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall through to the legacy copy path.
    }

    try {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.setAttribute('readonly', '');
      helper.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(helper);
      helper.select();
      helper.setSelectionRange(0, helper.value.length);
      const copied = document.execCommand('copy');
      helper.remove();
      return copied;
    } catch (error) {
      return false;
    }
  };

  /* Overlay manager */
  const overlayElements = [chapterMenu, detailSheet, lightbox, shareDialog].filter(Boolean);

  const syncBodyLock = () => {
    const hasOpenOverlay = overlayElements.some((element) => !element.hidden);
    body.classList.toggle('has-overlay', hasOpenOverlay);
  };

  const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

  const rememberFocus = (overlay) => {
    if (document.activeElement instanceof HTMLElement) focusReturn.set(overlay, document.activeElement);
  };

  const restoreFocus = (overlay) => {
    const target = focusReturn.get(overlay);
    if (target && target.isConnected) target.focus({ preventScroll: true });
  };

  const openOverlay = (overlay, focusTarget) => {
    if (!overlay) return;
    rememberFocus(overlay);
    overlay.hidden = false;
    syncBodyLock();
    window.requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      const target = focusTarget || $('.round-close, button, [href]', overlay);
      window.setTimeout(() => target?.focus({ preventScroll: true }), 80);
    });
  };

  const closeOverlay = (overlay, delay = 0) => {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-open');
    window.setTimeout(() => {
      overlay.hidden = true;
      syncBodyLock();
      restoreFocus(overlay);
    }, delay);
  };

  const visibleTopOverlay = () => [lightbox, detailSheet, shareDialog, chapterMenu]
    .find((element) => element && !element.hidden && element.classList.contains('is-open'));

  document.addEventListener('keydown', (event) => {
    const overlay = visibleTopOverlay();
    if (!overlay) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (overlay === lightbox) closeLightbox();
      else if (overlay === detailSheet) closeSheet();
      else if (overlay === shareDialog) closeShare();
      else if (overlay === chapterMenu) closeMenu();
      return;
    }

    if (event.key === 'Tab') {
      const focusables = $$(focusableSelector, overlay).filter((element) => (
        element.offsetParent !== null || element === document.activeElement
      ));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  /* Chapter menu */
  const menuTriggers = [$('#menuButton'), $('#menuButtonCompact')].filter(Boolean);

  const openMenu = () => {
    if (!chapterMenu) return;
    openOverlay(chapterMenu, $('.round-close', chapterMenu));
    menuTriggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'true'));
  };

  const closeMenu = () => {
    if (!chapterMenu) return;
    closeOverlay(chapterMenu, 560);
    menuTriggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
  };

  menuTriggers.forEach((trigger) => trigger.addEventListener('click', openMenu));
  $$('[data-close-menu]').forEach((element) => element.addEventListener('click', closeMenu));
  $$('.chapter-menu__nav a').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = $(link.getAttribute('href'));
      closeMenu();
      window.setTimeout(() => target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }), 80);
    });
  });

  /* Timeline */
  const timelineList = $('#timelineList');

  const renderTimeline = () => {
    if (!timelineList) return;
    timelineList.innerHTML = data.timeline.map((item, index) => `
      <article class="timeline__item" style="--item-index:${index}">
        <span class="timeline__dot" aria-hidden="true"></span>
        <button class="timeline__button" type="button" data-timeline-id="${escapeHtml(item.id)}" aria-label="查看${escapeHtml(item.phase)}：${escapeHtml(item.title)}">
          <span class="timeline__media">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.caption)}" loading="${index < 2 ? 'eager' : 'lazy'}" decoding="async" width="1080" height="1350">
          </span>
          <span class="timeline__body">
            <span class="timeline__meta"><i aria-hidden="true"></i>${escapeHtml(item.index)} / ${escapeHtml(item.phase)}<span class="timeline__year">${escapeHtml(item.year)}</span></span>
            <span class="timeline__image-caption">${escapeHtml(item.caption)}</span>
            <span class="timeline__title">${escapeHtml(item.title)}</span>
            <span class="timeline__body-copy">${escapeHtml(item.summary)}</span>
            <span class="timeline__placeholder">${escapeHtml(item.placeholder)}</span>
            <span class="timeline__open">展开这段历程
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
            </span>
          </span>
        </button>
      </article>
    `).join('');
  };

  renderTimeline();

  /* Sheet content builders */
  const sheetAction = (image, caption, closeLabel = '返回') => `
    <div class="sheet__actions">
      <button class="primary-button" type="button" data-lightbox="${escapeHtml(image)}" data-lightbox-caption="${escapeHtml(caption)}">查看场景大图</button>
      <button class="secondary-button" type="button" data-close-sheet>${escapeHtml(closeLabel)}</button>
    </div>
  `;

  const openTimeline = (item) => {
    if (!item) return;
    sheetContent.innerHTML = `
      <p class="sheet__eyebrow">${escapeHtml(item.index)} / ${escapeHtml(item.phase)} · ${escapeHtml(item.year)}</p>
      <h2 class="sheet__title" id="sheetTitle">${escapeHtml(item.title)}</h2>
      <div class="sheet__media">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.caption)}" loading="lazy">
        <span>${escapeHtml(item.caption)}</span>
      </div>
      <p class="sheet__copy">${escapeHtml(item.detail)}</p>
      <div class="sheet__placeholder">${escapeHtml(item.placeholder)}</div>
      ${sheetAction(item.image, item.caption, '返回时间轴')}
    `;
    openOverlay(detailSheet, $('.sheet__close', detailSheet));
  };

  const openHotspot = (spot) => {
    if (!spot) return;
    sheetContent.innerHTML = `
      <p class="sheet__eyebrow">${escapeHtml(spot.kicker)}</p>
      <h2 class="sheet__title" id="sheetTitle">${escapeHtml(spot.title)}</h2>
      <div class="sheet__media">
        <img src="${escapeHtml(spot.image)}" alt="岗位细节场景示意" loading="lazy">
        <span>岗位场景示意 · 非真实历史影像</span>
      </div>
      <p class="sheet__copy">${escapeHtml(spot.body)}</p>
      <div class="sheet__placeholder">${escapeHtml(spot.placeholder)}</div>
      ${sheetAction(spot.image, `${spot.title} · 场景示意`, '回到一线')}
    `;
    openOverlay(detailSheet, $('.sheet__close', detailSheet));
  };

  const openDuty = (item) => {
    if (!item) return;
    sheetContent.innerHTML = `
      <p class="sheet__eyebrow">${escapeHtml(item.index)} / ${escapeHtml(item.tab)} · SPECIAL FEATURE</p>
      <h2 class="sheet__title" id="sheetTitle">${escapeHtml(item.title)}</h2>
      <div class="sheet__media">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.caption)}" loading="lazy">
        <span>${escapeHtml(item.caption)}</span>
      </div>
      <p class="sheet__copy">${escapeHtml(item.summary)}\n\n${escapeHtml(item.body)}</p>
      <div class="sheet__placeholder">${escapeHtml(item.placeholder)}</div>
      ${sheetAction(item.image, item.caption, '返回专题')}
    `;
    openOverlay(detailSheet, $('.sheet__close', detailSheet));
  };

  const openLegacyStory = () => {
    sheetContent.innerHTML = `
      <p class="sheet__eyebrow">STORY / 01 · 师徒传承</p>
      <h2 class="sheet__title" id="sheetTitle">一把检车锤，两代人的约定</h2>
      <div class="sheet__media">
        <img src="assets/photos/16-legacy-compare.jpg" alt="铁路现场与设备场景示意" loading="lazy">
        <span>人物故事场景示意 · 非真实历史影像</span>
      </div>
      <p class="sheet__copy">师傅传授的不只是技术，更是责任。徒弟接过的不只是一把检车锤，更是一份沉甸甸的担当。\n\n这里预留天津车辆段真实师徒故事的展开位置。正式发布前，请补充经审核的师徒姓名、岗位经历、传授细节与共同完成的工作任务。</p>
      <div class="sheet__placeholder">【请补充真实师徒姓名、岗位与传承故事】</div>
      <div class="sheet__actions">
        <button class="primary-button" type="button" data-lightbox="assets/photos/16-legacy-compare.jpg" data-lightbox-caption="师徒传承场景示意 · 请替换为真实工作照片">查看场景大图</button>
        <button class="secondary-button" type="button" data-close-sheet>回到传承</button>
      </div>
    `;
    openOverlay(detailSheet, $('.sheet__close', detailSheet));
  };

  const closeSheet = () => closeOverlay(detailSheet, 540);

  /* Development tabs */
  const devTabs = $('#devTabs');
  const devStage = $('#devStage');
  let activeDev = 0;

  const renderDevTabs = () => {
    if (!devTabs) return;
    devTabs.innerHTML = data.development.map((item, index) => `
      <button class="dev-tab" id="dev-tab-${escapeHtml(item.id)}" type="button" role="tab"
        aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="dev-panel" tabindex="${index === 0 ? '0' : '-1'}" data-dev-index="${index}">
        <span>${escapeHtml(item.index)}</span>${escapeHtml(item.tab)}
      </button>
    `).join('');
    devTabs.scrollLeft = 0;
  };

  const renderDevPanel = (index) => {
    if (!devStage || !data.development.length) return;
    activeDev = (index + data.development.length) % data.development.length;
    const item = data.development[activeDev];
    $$('.dev-tab', devTabs).forEach((tab, tabIndex) => {
      const selected = tabIndex === activeDev;
      tab.setAttribute('aria-selected', String(selected));
      tab.setAttribute('tabindex', selected ? '0' : '-1');
    });

    devStage.innerHTML = `
      <article class="dev-panel" id="dev-panel" role="tabpanel" aria-labelledby="dev-tab-${escapeHtml(item.id)}" tabindex="0">
        <div class="dev-panel__media">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.caption)}" loading="lazy" decoding="async" width="1080" height="1350">
          <span class="dev-panel__media-tag">${escapeHtml(item.index)} / 05 · ${escapeHtml(item.tab)}</span>
          <span class="scene-note">场景示意 · 待替换</span>
        </div>
        <div class="dev-panel__body">
          <span class="dev-panel__index">DEVELOPMENT · ${escapeHtml(item.index)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="dev-panel__lead">${escapeHtml(item.lead)}</p>
          <p class="dev-panel__copy">${escapeHtml(item.body)}</p>
          <div class="dev-panel__slot">
            <strong>${escapeHtml(item.dataNote)}</strong>
            <span>REAL DATA<br>REQUIRED</span>
          </div>
          <button class="dev-panel__view" type="button" data-lightbox="${escapeHtml(item.image)}" data-lightbox-caption="${escapeHtml(item.caption)}">
            查看场景大图
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
          </button>
        </div>
      </article>
    `;
  };

  const setDev = (index, focus = false) => {
    renderDevPanel(index);
    const selectedTab = $(`.dev-tab[data-dev-index="${activeDev}"]`, devTabs);
    selectedTab?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    if (focus) selectedTab?.focus({ preventScroll: true });
  };

  renderDevTabs();
  renderDevPanel(0);

  devTabs?.addEventListener('click', (event) => {
    const tab = event.target.closest('.dev-tab');
    if (!tab) return;
    setDev(Number(tab.dataset.devIndex));
  });

  devTabs?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') setDev(activeDev - 1, true);
    if (event.key === 'ArrowRight') setDev(activeDev + 1, true);
    if (event.key === 'Home') setDev(0, true);
    if (event.key === 'End') setDev(data.development.length - 1, true);
  });

  /* Frontline hotspots and detail chips */
  const hotspotLayer = $('#hotspotLayer');
  const detailChips = $('#detailChips');

  if (hotspotLayer) {
    hotspotLayer.innerHTML = data.hotspots.map((spot) => `
      <button class="hotspot" type="button" style="left:${Number(spot.x)}%;top:${Number(spot.y)}%" data-hotspot-id="${escapeHtml(spot.id)}" aria-label="查看${escapeHtml(spot.label)}岗位细节">
        <span class="hotspot__dot" aria-hidden="true"></span>
        <span class="hotspot__label">${escapeHtml(spot.label)}</span>
      </button>
    `).join('');
  }

  if (detailChips) {
    detailChips.innerHTML = data.hotspots.map((spot) => `
      <button class="detail-chip" type="button" data-hotspot-id="${escapeHtml(spot.id)}">
        <span>${escapeHtml(spot.kicker)}</span>
        <strong>${escapeHtml(spot.label)}</strong>
      </button>
    `).join('');
  }

  const findHotspot = (id) => data.hotspots.find((spot) => spot.id === id);

  /* Duty cards */
  const dutyCards = $('#dutyCards');
  const dutyPrev = $('#dutyPrev');
  const dutyNext = $('#dutyNext');
  let dutyIndex = 0;

  const renderDutyCards = () => {
    if (!dutyCards) return;
    dutyCards.innerHTML = data.duty.map((item) => `
      <button class="duty-card" type="button" data-duty-id="${escapeHtml(item.id)}" aria-label="进入${escapeHtml(item.tab)}专题：${escapeHtml(item.title)}">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.caption)}" loading="lazy" decoding="async" width="1080" height="1350">
        <span class="duty-card__top"><span>${escapeHtml(item.index)} / 03</span><i aria-hidden="true"></i></span>
        <span class="duty-card__body">
          <span class="duty-card__tab">${escapeHtml(item.tab)}</span>
          <span class="duty-card__title">${escapeHtml(item.title)}</span>
          <span class="duty-card__summary">${escapeHtml(item.summary)}</span>
        </span>
        <span class="duty-card__cta">点击进入专题</span>
      </button>
    `).join('');
  };

  renderDutyCards();

  const goDuty = (direction) => {
    if (!dutyCards) return;
    const cards = $$('.duty-card', dutyCards);
    if (!cards.length) return;
    const gap = parseFloat(getComputedStyle(dutyCards).columnGap || getComputedStyle(dutyCards).gap || 13) || 13;
    const maxScroll = dutyCards.scrollWidth - dutyCards.clientWidth;
    if (dutyCards.scrollWidth <= dutyCards.clientWidth + 4) return;
    const step = cards[0].getBoundingClientRect().width + gap;
    dutyIndex = clamp(dutyIndex + direction, 0, cards.length - 1);
    dutyCards.scrollTo({ left: clamp(step * dutyIndex, 0, maxScroll), behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  dutyPrev?.addEventListener('click', () => goDuty(-1));
  dutyNext?.addEventListener('click', () => goDuty(1));

  dutyCards?.addEventListener('scroll', () => {
    if (!dutyCards || dutyCards.scrollWidth <= dutyCards.clientWidth + 4) return;
    const cards = $$('.duty-card', dutyCards);
    const width = cards[0]?.getBoundingClientRect().width || 1;
    dutyIndex = clamp(Math.round(dutyCards.scrollLeft / (width + 13)), 0, cards.length - 1);
  }, { passive: true });

  /* Lightbox */
  function openLightbox(src, caption) {
    if (!lightbox || !src) return;
    lightboxImage.src = src;
    lightboxImage.alt = caption || '场景大图';
    lightboxCaption.textContent = caption;
    openOverlay(lightbox, $('.round-close', lightbox));
  }

  function closeLightbox() {
    closeOverlay(lightbox, 380);
    window.setTimeout(() => {
      if (lightbox && !lightbox.classList.contains('is-open')) {
        lightboxImage.src = '';
        lightboxCaption.textContent = '';
      }
    }, 420);
  }

  $$('[data-close-lightbox]').forEach((element) => element.addEventListener('click', closeLightbox));

  /* Event delegation for data-driven interactions */
  document.addEventListener('click', (event) => {
    const timelineButton = event.target.closest('[data-timeline-id]');
    if (timelineButton) {
      openTimeline(data.timeline.find((item) => item.id === timelineButton.dataset.timelineId));
      return;
    }

    const hotspotButton = event.target.closest('[data-hotspot-id]');
    if (hotspotButton) {
      openHotspot(findHotspot(hotspotButton.dataset.hotspotId));
      return;
    }

    const dutyButton = event.target.closest('[data-duty-id]');
    if (dutyButton) {
      openDuty(data.duty.find((item) => item.id === dutyButton.dataset.dutyId));
      return;
    }

    const storyButton = event.target.closest('[data-sheet-kind="legacy"]');
    if (storyButton) {
      openLegacyStory();
      return;
    }

    const lightboxTrigger = event.target.closest('[data-lightbox]');
    if (lightboxTrigger) {
      openLightbox(lightboxTrigger.dataset.lightbox, lightboxTrigger.dataset.lightboxCaption || '');
      return;
    }

    if (event.target.closest('[data-close-sheet]')) closeSheet();
  });

  /* Share */
  const shareHint = $('#shareHint');
  const wechatTip = $('#wechatTip');
  const isWechat = /MicroMessenger/i.test(navigator.userAgent);

  const openShare = () => {
    if (!shareDialog) return;
    if (shareHint) {
      shareHint.textContent = isWechat
        ? '复制作品链接，或点击右上角「···」分享给朋友。'
        : '复制链接，发给并肩奋斗的同事。';
    }
    if (wechatTip) wechatTip.hidden = !isWechat;
    openOverlay(shareDialog, $('#copyLink'));
  };

  const closeShare = () => closeOverlay(shareDialog, 380);

  $('#shareButton')?.addEventListener('click', openShare);
  $('#finalShare')?.addEventListener('click', openShare);
  $$('[data-close-share]').forEach((element) => element.addEventListener('click', closeShare));

  $('#copyLink')?.addEventListener('click', async () => {
    const copied = await copyText(window.location.href);
    showToast(copied ? '作品链接已复制' : '复制失败，请手动复制地址栏链接');
  });

  /* Soundscape — synthesized low rail ambience, off by default */
  class RailAmbience {
    constructor(button) {
      this.button = button;
      this.ctx = null;
      this.master = null;
      this.bus = null;
      this.on = false;
      this.clackTimer = 0;
      this.noiseBuffer = null;
    }

    async build() {
      if (this.ctx) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is unavailable');

      const ctx = new AudioContextClass();
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      const bus = ctx.createGain();
      bus.gain.value = 0.88;
      bus.connect(master);

      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 155;
      lowPass.Q.value = 0.7;
      lowPass.connect(bus);

      const rumbleA = ctx.createOscillator();
      rumbleA.type = 'sine';
      rumbleA.frequency.value = 35.5;
      const rumbleAGain = ctx.createGain();
      rumbleAGain.gain.value = 0.052;
      rumbleA.connect(rumbleAGain).connect(lowPass);

      const rumbleB = ctx.createOscillator();
      rumbleB.type = 'sine';
      rumbleB.frequency.value = 53;
      const rumbleBGain = ctx.createGain();
      rumbleBGain.gain.value = 0.017;
      rumbleB.connect(rumbleBGain).connect(lowPass);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.055;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 44;
      lfo.connect(lfoGain).connect(lowPass.frequency);

      const noiseLength = Math.floor(ctx.sampleRate * 3.5);
      const buffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      let last = 0;
      for (let index = 0; index < noiseLength; index += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.018 * white) / 1.018;
        channel[index] = last * 3.2;
      }
      this.noiseBuffer = buffer;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 560;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.027;
      noise.connect(noiseFilter).connect(noiseGain).connect(bus);

      rumbleA.start();
      rumbleB.start();
      lfo.start();
      noise.start();

      this.ctx = ctx;
      this.master = master;
      this.bus = bus;
    }

    clack(offset = 0) {
      if (!this.ctx || !this.master) return;
      const ctx = this.ctx;
      const when = ctx.currentTime + offset;

      const impulse = ctx.createOscillator();
      impulse.type = 'triangle';
      impulse.frequency.setValueAtTime(82, when);
      impulse.frequency.exponentialRampToValueAtTime(42, when + 0.16);
      const impulseGain = ctx.createGain();
      impulseGain.gain.setValueAtTime(0.0001, when);
      impulseGain.gain.exponentialRampToValueAtTime(0.055, when + 0.008);
      impulseGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.27);
      impulse.connect(impulseGain).connect(this.master);
      impulse.start(when);
      impulse.stop(when + 0.3);

      if (!this.noiseBuffer) return;
      const metal = ctx.createBufferSource();
      metal.buffer = this.noiseBuffer;
      metal.playbackRate.value = 1.9;
      const metalFilter = ctx.createBiquadFilter();
      metalFilter.type = 'bandpass';
      metalFilter.frequency.value = 1250;
      metalFilter.Q.value = 0.75;
      const metalGain = ctx.createGain();
      metalGain.gain.setValueAtTime(0.0001, when);
      metalGain.gain.exponentialRampToValueAtTime(0.022, when + 0.006);
      metalGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
      metal.connect(metalFilter).connect(metalGain).connect(this.master);
      metal.start(when);
      metal.stop(when + 0.16);
    }

    scheduleClacks() {
      window.clearTimeout(this.clackTimer);
      if (!this.on) return;
      this.clack(0);
      this.clack(0.17);
      this.clack(0.34);
      this.clack(1.18);
      this.clack(1.34);
      this.clackTimer = window.setTimeout(() => this.scheduleClacks(), 2400 + Math.random() * 950);
    }

    setButtonState() {
      if (!this.button) return;
      body.dataset.sound = this.on ? 'on' : 'off';
      this.button.setAttribute('aria-pressed', String(this.on));
      this.button.setAttribute('aria-label', this.on ? '关闭环境声（合成音效）' : '开启环境声（合成音效）');
      this.button.title = this.on ? '关闭环境声' : '开启环境声';
    }

    async toggle() {
      if (this.on) {
        this.on = false;
        if (this.ctx && this.master) {
          this.master.gain.cancelScheduledValues(this.ctx.currentTime);
          this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.18);
        }
        window.clearTimeout(this.clackTimer);
        this.setButtonState();
        showToast('环境声已关闭');
        return;
      }

      try {
        await this.build();
        await this.ctx.resume();
        this.on = true;
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(0.72, this.ctx.currentTime, 0.6);
        this.scheduleClacks();
        this.setButtonState();
        showToast('环境声已开启 · 合成音效');
      } catch (error) {
        showToast('当前浏览器无法播放环境声');
      }
    }
  }

  const sound = new RailAmbience($('#soundToggle'));
  $('#soundToggle')?.addEventListener('click', () => sound.toggle());
  body.dataset.sound = 'off';

  document.addEventListener('visibilitychange', () => {
    if (!sound.ctx) return;
    if (document.hidden) sound.ctx.suspend().catch(() => {});
    else if (sound.on) sound.ctx.resume().catch(() => {});
  });

  /* Legacy compare slider */
  const compare = $('#compare');
  const compareRange = $('#compareRange');
  const updateCompare = (value) => {
    if (compare) compare.style.setProperty('--compare', `${clamp(Number(value), 0, 100)}%`);
  };
  compareRange?.addEventListener('input', (event) => updateCompare(event.target.value));
  updateCompare(compareRange?.value || 52);

  /* Message form — local only, no false submission state */
  const updateMessageCount = () => {
    if (!messageInput || !messageCount) return;
    messageCount.textContent = messageInput.value.length;
  };

  const setMessageStatus = (message, error = false) => {
    if (!messageStatus) return;
    messageStatus.textContent = message;
    messageStatus.classList.toggle('is-error', error);
  };

  if (messageInput) {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        messageInput.value = saved;
        setMessageStatus('已恢复上次保存在本机的寄语');
      }
    } catch (error) {
      // Local storage can be blocked in private browsing.
    }
    updateMessageCount();
    messageInput.addEventListener('input', () => {
      updateMessageCount();
      if (messageStatus?.textContent) setMessageStatus('');
    });
  }

  messageForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = messageInput?.value.trim() || '';
    if (!value) {
      setMessageStatus('请先写下一句寄语。', true);
      messageInput?.focus();
      return;
    }
    try {
      window.localStorage.setItem(storageKey, value);
      setMessageStatus('已保存到本机 · 不会上传，也不会公开展示');
      showToast('寄语已保存在本机');
    } catch (error) {
      setMessageStatus('浏览器未允许本地保存，请使用“复制寄语”。', true);
    }
  });

  $('#copyMessage')?.addEventListener('click', async () => {
    const value = messageInput?.value.trim() || '';
    if (!value) {
      setMessageStatus('请先写下一句寄语。', true);
      messageInput?.focus();
      return;
    }
    const copied = await copyText(value);
    setMessageStatus(copied ? '寄语已复制到剪贴板' : '复制失败，请长按文本手动复制', !copied);
    showToast(copied ? '寄语已复制' : '复制失败');
  });

  /* Scroll progress, active chapter, reveal and parallax */
  const sections = $$('.chapter[data-chapter]');
  const scrollProgress = $('#scrollProgress');
  const chapterCurrent = $('#chapterCurrent');
  const chapterFill = $('#chapterFill');
  const futureDawn = $('#futureDawn');
  const futureSection = $('#chapter-7');
  const parallaxItems = $$('[data-parallax]');
  const menuLinks = $$('.chapter-menu__nav a');
  let currentChapter = 1;
  let ticking = false;

  const updateScrollUI = () => {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollRatio = clamp(window.scrollY / scrollable, 0, 1);
    if (scrollProgress) scrollProgress.style.width = `${scrollRatio * 100}%`;

    let active = sections[0];
    const marker = window.innerHeight * 0.44;
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= marker) active = section;
    });
    const nextChapter = Number(active?.dataset.chapter || 1);
    if (nextChapter !== currentChapter) {
      currentChapter = nextChapter;
      if (chapterCurrent) chapterCurrent.textContent = pad(currentChapter);
      if (chapterFill) chapterFill.style.height = `${(currentChapter / 9) * 100}%`;
      menuLinks.forEach((link) => {
        link.classList.toggle('is-current', link.getAttribute('href') === `#chapter-${currentChapter}`);
      });
    }

    if (futureDawn && futureSection) {
      const rect = futureSection.getBoundingClientRect();
      const progress = clamp((window.innerHeight * 0.55 - rect.top) / Math.max(1, rect.height * 0.85), 0, 1);
      futureDawn.style.opacity = String(0.34 + progress * 0.52);
    }

    if (!reduceMotion && parallaxItems.length) {
      parallaxItems.forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.bottom < -window.innerHeight || rect.top > window.innerHeight * 2) return;
        const speed = Number(element.dataset.parallax) || 0.06;
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed;
        element.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0) scale(1.015)`;
      });
    }

    ticking = false;
  };

  const requestScrollUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateScrollUI);
  };

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate, { passive: true });
  updateScrollUI();

  /* Reveal animations */
  const revealElements = $$('.reveal');
  $$('.future__directions .reveal').forEach((element, index) => {
    element.style.transitionDelay = `${index * 75}ms`;
  });

  if ('IntersectionObserver' in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.09 });
    revealElements.forEach((element) => revealObserver.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  }

  if ('IntersectionObserver' in window && !reduceMotion) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-in-view', entry.isIntersecting));
    }, { threshold: 0.08 });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  $('#heroNext')?.addEventListener('click', () => {
    $('#chapter-2')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });

  $('#replayButton')?.addEventListener('click', () => {
    closeShare();
    closeSheet();
    closeLightbox();
    closeMenu();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    body.classList.remove('is-ready');
    window.setTimeout(() => {
      body.classList.add('is-ready');
      showToast('已返回开篇');
    }, 900);
  });

  window.addEventListener('hashchange', requestScrollUpdate);
})();



