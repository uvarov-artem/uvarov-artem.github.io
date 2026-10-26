/* Админка: редактирует data/content.json и загружает фото через GitHub API */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => c != null && el.append(c));
    return el;
  };

  const CFG_KEY = 'uvarov:gh';
  const DRAFT_KEY = 'uvarov:draft';
  const DIRTY_KEY = 'uvarov:dirty';
  const CONTENT_PATH = 'data/content.json';

  /* ---------- Описание разделов ---------- */
  const T = (key, label, hint) => ({ key, label, type: 'text', hint });
  const TA = (key, label, hint) => ({ key, label, type: 'textarea', hint });
  const IMG = (key = 'image', label = 'Фото') => ({ key, label, type: 'image' });

  const SECTIONS = [
    { key: 'contacts', title: 'Контакты', type: 'group', note: 'Эти данные используются в шапке, форме заявки, кнопках мессенджеров и подвале.', fields: [
      T('name', 'Имя и фамилия'),
      T('phoneDisplay', 'Телефон — как показывать', 'Например: +7 900 123-45-67'),
      T('phone', 'Телефон — для звонка', 'Только цифры с +7, например +79001234567'),
      T('telegram', 'Telegram — username или телефон', 'Username без @ (artem_uvarov) или номер +79001234567. С username заявка подставляется в чат сама'),
      T('whatsapp', 'WhatsApp — номер', 'Только цифры, начиная с 7: 79001234567'),
      T('city', 'География работ'),
      T('hours', 'Режим работы')
    ] },
    { key: 'hero', title: 'Первый экран', type: 'group', fields: [
      T('eyebrow', 'Надзаголовок'),
      TA('title', 'Заголовок', 'Слова между *звёздочками* выделяются оранжевым'),
      TA('subtitle', 'Подзаголовок'),
      IMG('image', 'Фото справа'),
      { key: 'stats', label: 'Цифры', type: 'pairs', a: 'value', b: 'label', aLabel: 'Значение', bLabel: 'Подпись', swap: true }
    ] },
    { key: 'services', title: 'Услуги и цены', type: 'list', titleKey: 'title',
      blank: () => ({ id: 's' + Date.now(), title: 'Новое направление', short: '', priceFrom: '', image: '', items: [] }),
      fields: [
        T('title', 'Название'),
        TA('short', 'Короткое описание'),
        T('priceFrom', 'Цена «от»', 'Например: от 1 500 ₽/м²'),
        IMG(),
        { key: 'items', label: 'Прайс', type: 'pairs', a: 'name', b: 'price', aLabel: 'Работа', bLabel: 'Цена' }
      ] },
    { key: 'myheat', title: 'Блок MyHeat', type: 'group', fields: [
      TA('title', 'Заголовок'), TA('text', 'Текст'), { key: 'points', label: 'Пункты', type: 'strings' }
    ] },
    { key: 'works', title: 'Работы (портфолио)', type: 'list', titleKey: 'title',
      note: 'По полю «Категория» строятся фильтры над галереей.',
      blank: () => ({ title: 'Новый объект', tag: 'Электрика', meta: '', image: '' }),
      fields: [T('title', 'Название'), T('tag', 'Категория'), T('meta', 'Детали', 'Например: 48 модулей · АВР'), IMG()] },
    { key: 'about', title: 'Обо мне', type: 'group', fields: [
      TA('title', 'Заголовок'), TA('text', 'Текст'), IMG(), { key: 'points', label: 'Пункты', type: 'strings' }
    ] },
    { key: 'process', title: 'Этапы работы', type: 'list', titleKey: 'title',
      blank: () => ({ title: 'Новый этап', text: '' }), fields: [T('title', 'Название'), TA('text', 'Описание')] },
    { key: 'advantages', title: 'Гарантии', type: 'list', titleKey: 'title',
      blank: () => ({ title: 'Новое преимущество', text: '' }), fields: [T('title', 'Заголовок'), TA('text', 'Текст')] },
    { key: 'reviews', title: 'Отзывы', type: 'list', titleKey: 'name',
      note: 'Публикуйте только настоящие отзывы клиентов. Если список пуст — блок скрывается.',
      blank: () => ({ name: '', object: '', text: '' }), fields: [T('name', 'Имя клиента'), T('object', 'Объект'), TA('text', 'Отзыв')] },
    { key: 'faq', title: 'Вопросы и ответы', type: 'list', titleKey: 'q',
      blank: () => ({ q: 'Новый вопрос', a: '' }), fields: [T('q', 'Вопрос'), TA('a', 'Ответ')] },
    { key: 'form', title: 'Форма заявки', type: 'group', fields: [TA('title', 'Заголовок'), TA('text', 'Текст')] },
    { key: 'seo', title: 'SEO', type: 'group', note: 'Как сайт выглядит в поиске Яндекса и Google.', fields: [
      T('title', 'Заголовок страницы', 'До 70 символов'), TA('description', 'Описание', 'До 160 символов')
    ] }
  ];

  /* ---------- Состояние ---------- */
  let cfg = null;              // { owner, repo, branch, token } или null — офлайн-режим
  let data = null;
  let current = 'contacts';
  const openItems = {};        // раскрытые карточки списков
  const localImg = {};         // путь → dataURL для ещё не опубликованных фото

  /* ---------- Утилиты ---------- */
  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('bad', !!bad);
    t.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('on'), bad ? 6000 : 3500);
  }
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* приватный режим */ } }
  };
  function bytesToB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const textToB64 = s => bytesToB64(new TextEncoder().encode(s));
  const b64ToText = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const imgUrl = p => !p ? '' : localImg[p] || (/^(https?:|data:)/.test(p) ? p : '../' + p);
  const slug = s => s.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'photo';

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/${path}`, {
      ...opts,
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + cfg.token, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = { 401: 'Токен недействителен или истёк', 403: 'У токена нет прав на запись (Contents: Read and write)', 404: 'Репозиторий, ветка или файл не найдены', 409: 'Конфликт версий — обновите страницу', 422: 'GitHub отклонил запрос' }[res.status];
      throw new Error((msg || 'Ошибка GitHub ' + res.status) + (body.message ? ` (${body.message})` : ''));
    }
    return res.json();
  }
  const getFile = p => gh(`contents/${p}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
  const putFile = (p, b64, message, sha) => gh(`contents/${p}`, { method: 'PUT', body: JSON.stringify({ message, content: b64, branch: cfg.branch, ...(sha ? { sha } : {}) }) });

  /* ---------- Загрузка данных ---------- */
  async function loadData() {
    let remote;
    if (cfg) remote = JSON.parse(b64ToText((await getFile(CONTENT_PATH)).content));
    else remote = await (await fetch('../' + CONTENT_PATH + '?v=' + Date.now(), { cache: 'no-store' })).json();

    const draft = store.get(DRAFT_KEY);
    if (store.get(DIRTY_KEY) === '1' && draft && draft !== JSON.stringify(remote)) {
      if (confirm('Найден неопубликованный черновик с прошлого раза. Восстановить его?')) {
        data = JSON.parse(draft);
        setStatus('dirty');
        return;
      }
      store.del(DIRTY_KEY);
    }
    data = remote;
    setStatus('clean');
  }

  function setStatus(s) {
    const el = $('#status');
    el.className = 'status ' + (s === 'dirty' ? 'dirty' : s === 'ok' ? 'ok' : '');
    el.textContent = { dirty: '● есть неопубликованные изменения', ok: '✓ опубликовано, сайт обновится через 1–2 минуты', clean: 'изменений нет', busy: 'сохраняю…' }[s] || '';
  }
  function changed() {
    store.set(DRAFT_KEY, JSON.stringify(data));
    store.set(DIRTY_KEY, '1');
    setStatus('dirty');
  }

  /* ---------- Поля ---------- */
  function fieldText(def, obj) {
    const input = def.type === 'textarea'
      ? h('textarea', { rows: 3 })
      : h('input', { type: 'text' });
    input.value = obj[def.key] ?? '';
    input.addEventListener('input', () => { obj[def.key] = input.value; changed(); input.dispatchEvent(new CustomEvent('field', { bubbles: true })); });
    return h('label', { class: 'fld' }, h('span', {}, def.label), input, def.hint ? h('small', {}, def.hint) : null);
  }

  function fieldImage(def, obj) {
    const prev = h('div', { class: 'img__prev' });
    const path = h('input', { type: 'text', placeholder: 'images/…' });
    const refresh = () => { prev.style.backgroundImage = obj[def.key] ? `url("${imgUrl(obj[def.key])}")` : ''; path.value = obj[def.key] || ''; prev.dispatchEvent(new CustomEvent('field', { bubbles: true })); };
    path.addEventListener('change', () => { obj[def.key] = path.value.trim(); refresh(); changed(); });
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const btn = h('button', { class: 'btn btn--dark btn--sm', type: 'button', onclick: () => file.click() }, 'Загрузить фото');
    file.addEventListener('change', async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      if (!cfg) return toast('Чтобы загружать фото, подключитесь к GitHub', true);
      btn.disabled = true; btn.textContent = 'Загружаю…';
      try {
        const { b64, dataUrl } = await compress(f);
        const p = `images/uploads/${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}-${slug(f.name)}.jpg`;
        await putFile(p, b64, 'Загрузка фото: ' + f.name);
        localImg[p] = dataUrl;
        obj[def.key] = p;
        refresh(); changed();
        toast('Фото загружено. Не забудьте нажать «Опубликовать»');
      } catch (e) { toast(e.message, true); }
      btn.disabled = false; btn.textContent = 'Загрузить фото';
    });
    refresh();
    return h('div', { class: 'fld' }, h('span', {}, def.label),
      h('div', { class: 'img' }, prev, h('div', { class: 'img__ctl' }, h('div', { class: 'btns' }, btn, file), path, h('small', {}, 'Фото автоматически уменьшается до 2000 px и сжимается.'))));
  }

  async function compress(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', .84);
    return { dataUrl, b64: dataUrl.split(',')[1] };
  }

  // Мини-таблица: строки (пункты) или пары (работа — цена)
  function fieldRows(def, obj) {
    if (!Array.isArray(obj[def.key])) obj[def.key] = [];
    const arr = obj[def.key];
    const isPairs = def.type === 'pairs';
    const box = h('div', { class: 'mini' });
    const draw = () => {
      box.replaceChildren(...arr.map((row, i) => {
        const tools = h('div', { class: 'mini__tools' },
          h('button', { class: 'ico', type: 'button', title: 'Выше', onclick: () => move(i, -1) }, '↑'),
          h('button', { class: 'ico del', type: 'button', title: 'Удалить', onclick: () => { arr.splice(i, 1); changed(); draw(); } }, '✕'));
        if (!isPairs) {
          const inp = h('input', { value: row });
          inp.addEventListener('input', () => { arr[i] = inp.value; changed(); });
          return h('div', { class: 'mini__row one' }, inp, tools);
        }
        const mk = (k, ph) => { const inp = h('input', { value: row[k] ?? '', placeholder: ph }); inp.addEventListener('input', () => { row[k] = inp.value; changed(); }); return inp; };
        return def.swap
          ? h('div', { class: 'mini__row', style: 'grid-template-columns:140px 1fr auto' }, mk(def.a, def.aLabel), mk(def.b, def.bLabel), tools)
          : h('div', { class: 'mini__row' }, mk(def.a, def.aLabel), mk(def.b, def.bLabel), tools);
      }), h('button', { class: 'btn btn--line btn--sm add', type: 'button', onclick: () => { arr.push(isPairs ? { [def.a]: '', [def.b]: '' } : ''); changed(); draw(); box.querySelector('.mini__row:last-of-type input')?.focus(); } }, '+ Добавить строку'));
    };
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; changed(); draw(); };
    draw();
    return h('div', { class: 'fld' }, h('span', {}, def.label + (isPairs ? ` (${def.aLabel} / ${def.bLabel})` : '')), box);
  }

  function renderFields(fields, obj) {
    const out = [];
    let textRow = [];
    const flush = () => { if (textRow.length) { out.push(textRow.length > 1 ? h('div', { class: 'row' }, textRow) : textRow[0]); textRow = []; } };
    fields.forEach(def => {
      if (def.type === 'text') { textRow.push(fieldText(def, obj)); return; }
      flush();
      if (def.type === 'textarea') out.push(fieldText(def, obj));
      else if (def.type === 'image') out.push(fieldImage(def, obj));
      else out.push(fieldRows(def, obj));
    });
    flush();
    return out;
  }

  /* ---------- Разделы ---------- */
  function renderList(sec) {
    if (!Array.isArray(data[sec.key])) data[sec.key] = [];
    const arr = data[sec.key];
    const open = openItems[sec.key] || (openItems[sec.key] = new Set());
    const list = h('div', { class: 'list' });
    const draw = () => {
      list.replaceChildren(...arr.map((it, i) => {
        const title = h('b', {}, it[sec.titleKey] || 'Без названия');
        const thumb = it.image ? h('img', { src: imgUrl(it.image), alt: '' }) : null;
        const item = h('div', { class: 'item' + (open.has(i) ? ' open' : '') },
          h('div', { class: 'item__head', onclick: e => { if (e.target.closest('.item__tools')) return; item.classList.toggle('open'); item.classList.contains('open') ? open.add(i) : open.delete(i); } },
            h('span', { class: 'chev' }, '›'), h('span', { class: 'n' }, String(i + 1).padStart(2, '0')), thumb, title,
            h('div', { class: 'item__tools' },
              h('button', { class: 'ico', type: 'button', title: 'Выше', onclick: () => move(i, -1) }, '↑'),
              h('button', { class: 'ico', type: 'button', title: 'Ниже', onclick: () => move(i, 1) }, '↓'),
              h('button', { class: 'ico del', type: 'button', title: 'Удалить', onclick: () => { if (confirm(`Удалить «${it[sec.titleKey] || 'элемент'}»?`)) { arr.splice(i, 1); open.clear(); changed(); draw(); } } }, '✕'))),
          h('div', { class: 'item__body' }, renderFields(sec.fields, it)));
        item.addEventListener('field', () => { title.textContent = it[sec.titleKey] || 'Без названия'; if (thumb && it.image) thumb.src = imgUrl(it.image); });
        return item;
      }));
    };
    const move = (i, d) => {
      const j = i + d;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      const oi = open.has(i), oj = open.has(j);
      open.delete(i); open.delete(j); if (oi) open.add(j); if (oj) open.add(i);
      changed(); draw();
    };
    draw();
    const add = h('button', { class: 'btn btn--dark add', type: 'button', onclick: () => { arr.push(sec.blank()); open.add(arr.length - 1); changed(); draw(); list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, '+ Добавить');
    return [list, add];
  }

  function renderSection() {
    const sec = SECTIONS.find(s => s.key === current);
    $('#secTitle').textContent = sec.title;
    $$('#sideNav button').forEach(b => b.classList.toggle('on', b.dataset.key === current));
    if (!data[sec.key]) data[sec.key] = sec.type === 'list' ? [] : {};
    const body = sec.type === 'list' ? renderList(sec) : [h('div', { class: 'card' }, renderFields(sec.fields, data[sec.key]))];
    $('#editor').replaceChildren(sec.note ? h('div', { class: 'hint' }, sec.note) : '', ...body);
    window.scrollTo(0, 0);
  }
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function renderNav() {
    $('#sideNav').replaceChildren(...SECTIONS.map(s => h('button', { type: 'button', 'data-key': s.key, onclick: () => { current = s.key; renderSection(); $('.side').classList.remove('open'); } },
      s.title, s.type === 'list' ? h('small', {}, String((data[s.key] || []).length)) : '')));
  }

  /* ---------- Действия ---------- */
  async function publish() {
    if (!cfg) { exportJson(); return toast('Офлайн-режим: JSON скачан. Загрузите его в репозиторий вручную как data/content.json'); }
    const btn = $('#publishBtn');
    btn.disabled = true; setStatus('busy');
    try {
      const { sha } = await getFile(CONTENT_PATH);
      await putFile(CONTENT_PATH, textToB64(JSON.stringify(data, null, 2) + '\n'), 'Обновление контента сайта', sha);
      store.del(DIRTY_KEY);
      setStatus('ok');
      toast('Опубликовано! Сайт обновится через 1–2 минуты');
    } catch (e) { setStatus('dirty'); toast(e.message, true); }
    btn.disabled = false;
  }

  function exportJson() {
    const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' })), download: 'content.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function initEditor() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#repoLabel').textContent = cfg ? `${cfg.owner}/${cfg.repo}` : 'офлайн-режим';
    renderNav();
    renderSection();
    $('#editor').addEventListener('input', () => renderNavCounts());
    $('#publishBtn').onclick = publish;
    $('#publishBtn').textContent = cfg ? 'Опубликовать' : 'Скачать JSON';
    $('#previewBtn').onclick = () => { store.set(DRAFT_KEY, JSON.stringify(data)); window.open('../?preview=1', '_blank'); };
    $('#exportBtn').onclick = exportJson;
    $('#importInput').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try { data = JSON.parse(await f.text()); changed(); renderNav(); renderSection(); toast('JSON загружен — проверьте и опубликуйте'); }
      catch { toast('Не удалось прочитать файл', true); }
      e.target.value = '';
    };
    $('#logoutBtn').onclick = () => { if (confirm('Выйти и забыть токен в этом браузере?')) { store.del(CFG_KEY); location.reload(); } };
    $('#menuBtn').onclick = () => $('.side').classList.toggle('open');
    addEventListener('beforeunload', e => { if (store.get(DIRTY_KEY) === '1') { e.preventDefault(); e.returnValue = ''; } });
    addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); publish(); } });
  }
  function renderNavCounts() {
    $$('#sideNav button').forEach(b => {
      const s = SECTIONS.find(x => x.key === b.dataset.key);
      if (s.type === 'list') b.querySelector('small').textContent = (data[s.key] || []).length;
    });
  }

  /* ---------- Вход ---------- */
  function guessRepo() {
    const host = location.hostname;
    if (!host.endsWith('.github.io')) return {};
    const owner = host.split('.')[0];
    const seg = location.pathname.split('/').filter(Boolean);
    return { owner, repo: seg[0] && seg[0] !== 'admin' ? seg[0] : host };
  }

  async function start() {
    try { cfg = JSON.parse(store.get(CFG_KEY) || 'null'); } catch { cfg = null; }
    if (!cfg) return showLogin();
    try { await loadData(); initEditor(); }
    catch (e) { showLogin(e.message); }
  }

  function showLogin(error) {
    $('#login').hidden = false;
    const f = $('#loginForm');
    const g = { ...guessRepo(), ...(cfg || {}) };
    ['owner', 'repo', 'branch'].forEach(k => { if (g[k]) f.elements[k].value = g[k]; });
    if (error) { $('#loginErr').textContent = error; $('#loginErr').hidden = false; }
    f.onsubmit = async e => {
      e.preventDefault();
      cfg = Object.fromEntries(['owner', 'repo', 'branch', 'token'].map(k => [k, f.elements[k].value.trim()]));
      const btn = f.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Проверяю…';
      try {
        await loadData();
        store.set(CFG_KEY, JSON.stringify(cfg));
        initEditor();
      } catch (err) {
        $('#loginErr').textContent = err.message; $('#loginErr').hidden = false;
        cfg = null;
      }
      btn.disabled = false; btn.textContent = 'Подключиться';
    };
    $('#offlineBtn').onclick = async () => {
      cfg = null;
      try { await loadData(); initEditor(); } catch (err) { $('#loginErr').textContent = 'Не удалось загрузить контент: ' + err.message; $('#loginErr').hidden = false; }
    };
  }

  start();
})();
