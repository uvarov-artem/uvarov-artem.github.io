/* Уваров — электромонтаж. Весь контент берётся из data/content.json (редактируется в /admin) */
(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // *слово* в тексте из админки выделяется акцентным цветом
  const rich = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const digits = s => String(s || '').replace(/\D/g, '');
  const tgUser = s => String(s || '').trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
  // В поле Telegram можно указать username или номер телефона
  const tgIsPhone = s => /^\+?[\d\s()-]{10,}$/.test(String(s || '').trim());

  const ICONS = [
    '<path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6"/>',
    '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="17" r="3"/>',
    '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>'
  ];
  const PLUS = '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  const ARROW = '<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  async function loadContent() {
    const params = new URLSearchParams(location.search);
    if (params.has('preview')) {
      try {
        const draft = localStorage.getItem('uvarov:draft');
        if (draft) { $('#previewBanner').hidden = false; return JSON.parse(draft); }
      } catch (e) { /* нет доступа к localStorage — берём опубликованное */ }
    }
    const res = await fetch('data/content.json?v=' + Date.now(), { cache: 'no-store' });
    return res.json();
  }

  function render(c) {
    const ct = c.contacts || {};
    const tgPhone = tgIsPhone(ct.telegram);
    const tg = tgPhone ? '+' + digits(ct.telegram) : tgUser(ct.telegram);
    const links = {
      phone: { href: 'tel:' + (ct.phone || '').replace(/[^\d+]/g, ''), text: ct.phoneDisplay || ct.phone },
      tgLink: { href: 'https://t.me/' + tg, text: tgPhone ? ct.phoneDisplay || tg : '@' + tg },
      waLink: { href: 'https://wa.me/' + digits(ct.whatsapp), text: ct.phoneDisplay || '+' + digits(ct.whatsapp) }
    };

    if (c.seo) {
      if (c.seo.title) document.title = c.seo.title;
      if (c.seo.description) $('meta[name="description"]').setAttribute('content', c.seo.description);
    }

    $$('[data-bind]').forEach(el => {
      const key = el.dataset.bind;
      if (links[key]) {
        el.href = links[key].href;
        if (!el.children.length && (!el.textContent.trim() || el.dataset.filled)) { el.textContent = links[key].text; el.dataset.filled = 1; }
        return;
      }
      const v = get(c, key);
      if (v != null) el.innerHTML = rich(v);
    });
    $$('[data-bind-src]').forEach(el => { const v = get(c, el.dataset.bindSrc); if (v) el.src = v; });
    $('#year').textContent = new Date().getFullYear();

    // Цифры на первом экране
    $('#heroStats').innerHTML = (c.hero?.stats || []).map(s => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('');

    // Услуги
    const services = c.services || [];
    $('#svcList').innerHTML = services.map((s, i) => `
      <article class="svc__item" data-img="${esc(s.image)}">
        <button class="svc__row" aria-expanded="false">
          <span class="svc__num">${String(i + 1).padStart(2, '0')}</span>
          <span class="svc__title">${esc(s.title)}</span>
          <span class="svc__short">${esc(s.short)}</span>
          <span class="svc__price">${esc(s.priceFrom)}</span>
          <span class="svc__plus">${PLUS}</span>
        </button>
        <div class="svc__body"><div>
          <div class="svc__panel">
            ${s.image ? `<figure class="svc__img"><img src="${esc(s.image)}" alt="${esc(s.title)}" loading="lazy"></figure>` : ''}
            <div>
              <ul class="prices">${(s.items || []).map(it => `<li><span class="p-name">${esc(it.name)}</span><span class="p-price">${esc(it.price)}</span></li>`).join('')}</ul>
              <div class="svc__actions">
                <a class="btn btn--accent btn--sm" href="#contact" data-pick="${esc(s.title)}">Заказать ${ARROW}</a>
              </div>
            </div>
          </div>
        </div></div>
      </article>`).join('');

    // Пункты-галочки
    const ticks = arr => (arr || []).map(p => `<li>${esc(p)}</li>`).join('');
    $('#myheatPoints').innerHTML = ticks(c.myheat?.points);
    $('#aboutPoints').innerHTML = ticks(c.about?.points);

    // Работы + фильтр
    const works = c.works || [];
    const layout = workLayout(works.length);
    $('#worksGrid').innerHTML = works.map((w, i) => `
      <figure class="work reveal" data-tag="${esc(w.tag)}" style="--span:${layout[i].span};--ar:${layout[i].ar}">
        <div class="work__img"><img src="${esc(w.image)}" alt="${esc(w.title)}" loading="lazy"></div>
        <figcaption class="work__cap">
          <span class="work__title">${esc(w.title)}</span>
          <span class="work__tag">${esc(w.tag)}</span>
          <span class="work__meta">${esc(w.meta)}</span>
        </figcaption>
      </figure>`).join('');
    const tags = [...new Set(works.map(w => w.tag).filter(Boolean))];
    $('#workFilters').innerHTML = tags.length > 1
      ? ['Все', ...tags].map((t, i) => `<button class="filter${i ? '' : ' is-active'}" data-tag="${i ? esc(t) : ''}">${esc(t)}</button>`).join('')
      : '';

    // Этапы и преимущества
    $('#steps').innerHTML = (c.process || []).map(s => `<li class="step"><span class="step__n">${String((c.process || []).length).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('');
    $('#adv').innerHTML = (c.advantages || []).map((a, i) => `<div class="adv__card reveal"><svg class="i" viewBox="0 0 24 24">${ICONS[i % ICONS.length]}</svg><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></div>`).join('');

    // Отзывы
    $('#reviews-track').innerHTML = (c.reviews || []).map(r => `
      <blockquote class="review">
        <span class="review__q">“</span>
        <p class="review__text">${esc(r.text)}</p>
        <footer class="review__who"><b>${esc(r.name)}</b><span>${esc(r.object)}</span></footer>
      </blockquote>`).join('');
    if (!(c.reviews || []).length) $('#reviews').hidden = true;

    // Вопросы
    $('#faqList').innerHTML = (c.faq || []).map((f, i) => `<details${i ? '' : ' open'}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');

    // Чипы услуг в форме
    $('#svcChips').innerHTML = services.map(s => `<label class="chip"><input type="checkbox" name="svc" value="${esc(s.title)}"><span>${esc(s.title)}</span></label>`).join('')
      + `<label class="chip"><input type="checkbox" name="svc" value="Другое"><span>Другое</span></label>`;

    return { tg, tgPhone, wa: digits(ct.whatsapp), name: ct.name };
  }

  // Редакционная сетка работ: ряды 7+5, 4+4+4, 5+7… Картинки в одном ряду одной высоты
  function workLayout(n) {
    const rows = [[7, 5], [4, 4, 4], [5, 7], [4, 4, 4]];
    const out = [];
    for (let r = 0; out.length < n; r++) {
      let row = rows[r % rows.length];
      const left = n - out.length;
      if (left < row.length) row = left === 1 ? [12] : [6, 6];
      const h = row.length === 3 ? 3 : row.length === 2 ? 4.4 : 5.2;
      row.forEach(span => out.push({ span, ar: `${span} / ${h}` }));
    }
    return out;
  }

  /* ---------- Поведение ---------- */
  function initHeader() {
    const header = $('#header');
    const mbar = $('#mbar');
    const contact = $('#contact');
    let lastY = 0;
    const onScroll = () => {
      const y = scrollY;
      header.classList.toggle('is-solid', y > 40);
      header.classList.toggle('is-hidden', y > 600 && y > lastY && !document.body.classList.contains('nav-open'));
      const cr = contact.getBoundingClientRect();
      mbar.classList.toggle('is-on', y > innerHeight * .7 && cr.top > innerHeight * .6);
      lastY = y;
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const burger = $('#burger');
    const toggle = open => {
      document.body.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open);
    };
    burger.addEventListener('click', () => toggle(!document.body.classList.contains('nav-open')));
    $$('#nav a').forEach(a => a.addEventListener('click', () => toggle(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
  }

  function initServices() {
    const list = $('#svcList');
    list.addEventListener('click', e => {
      const row = e.target.closest('.svc__row');
      if (row) {
        const item = row.parentElement;
        const open = !item.classList.contains('is-open');
        item.classList.toggle('is-open', open);
        row.setAttribute('aria-expanded', open);
      }
      const pick = e.target.closest('[data-pick]');
      if (pick) preselect(pick.dataset.pick);
    });

    // Плавающее превью при наведении (только мышь)
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const box = $('#cursorImg');
    const img = $('img', box);
    let x = 0, y = 0, cx = 0, cy = 0, raf;
    const loop = () => {
      cx += (x - cx) * .16; cy += (y - cy) * .16;
      box.style.left = cx + 'px'; box.style.top = cy + 'px';
      raf = requestAnimationFrame(loop);
    };
    list.addEventListener('mousemove', e => { x = e.clientX + 170; y = e.clientY; });
    $$('.svc__item', list).forEach(item => {
      const row = $('.svc__row', item);
      row.addEventListener('mouseenter', e => {
        if (item.classList.contains('is-open') || !item.dataset.img) return;
        img.src = item.dataset.img;
        if (!box.classList.contains('is-on')) { cx = x = e.clientX + 170; cy = y = e.clientY; }
        box.classList.add('is-on');
        cancelAnimationFrame(raf); loop();
      });
      row.addEventListener('mouseleave', () => { box.classList.remove('is-on'); cancelAnimationFrame(raf); });
      row.addEventListener('click', () => box.classList.remove('is-on'));
    });
  }

  function preselect(title) {
    $$('#svcChips input').forEach(i => { if (i.value === title) i.checked = true; });
  }

  function initWorks() {
    const grid = $('#worksGrid');
    $('#workFilters').addEventListener('click', e => {
      const b = e.target.closest('.filter');
      if (!b) return;
      $$('.filter').forEach(f => f.classList.toggle('is-active', f === b));
      const tag = b.dataset.tag;
      grid.classList.toggle('is-filtered', !!tag);
      $$('.work', grid).forEach(w => w.classList.toggle('is-hidden', !!tag && w.dataset.tag !== tag));
    });

    const lb = $('#lightbox');
    const close = () => { lb.hidden = true; document.body.style.overflow = ''; };
    grid.addEventListener('click', e => {
      const w = e.target.closest('.work');
      if (!w) return;
      $('img', lb).src = $('img', w).src;
      $('p', lb).textContent = $('.work__title', w).textContent + ' — ' + $('.work__meta', w).textContent;
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
    });
    lb.addEventListener('click', e => { if (e.target.tagName !== 'IMG') close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) close(); });
  }

  function initReviews() {
    const track = $('#reviews-track');
    $$('[data-scroll]').forEach(b => b.addEventListener('click', () => {
      const card = $('.review', track);
      track.scrollBy({ left: (card ? card.offsetWidth + 20 : 400) * +b.dataset.scroll, behavior: 'smooth' });
    }));
  }

  function initReveal() {
    const els = $$('.reveal, .step');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    els.forEach((e, i) => { e.style.transitionDelay = (e.classList.contains('work') || e.classList.contains('adv__card') ? (i % 3) * 80 : 0) + 'ms'; io.observe(e); });
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 5000);
  }

  function initForm(ctx) {
    const form = $('#leadForm');
    const err = $('#formErr');
    let via = 'tg';
    $$('[data-via]', form).forEach(b => b.addEventListener('click', () => { via = b.dataset.via; }));

    // Мягкая маска телефона
    const phone = form.elements.phone;
    phone.addEventListener('input', () => {
      let d = digits(phone.value);
      if (!d) { phone.value = ''; return; }
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);
      const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
      phone.value = '+7' + (p[0] ? ' ' + p[0] : '') + (p[1] ? ' ' + p[1] : '') + (p[2] ? '-' + p[2] : '') + (p[3] ? '-' + p[3] : '');
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (e.submitter?.dataset.via) via = e.submitter.dataset.via;
      const f = form.elements;
      const svcs = $$('input[name="svc"]:checked', form).map(i => i.value);
      const name = f.name.value.trim();
      f.name.closest('.field').classList.toggle('is-err', !name);
      if (!name) { err.textContent = 'Укажите, как к вам обращаться.'; err.hidden = false; f.name.focus(); return; }
      err.hidden = true;

      const first = (ctx.name || '').trim().split(' ')[0];
      const lines = [
        `Здравствуйте${first ? ', ' + first : ''}! Заявка с сайта.`,
        '',
        `Услуги: ${svcs.length ? svcs.join(', ') : 'нужна консультация'}`,
        `Объект: ${f.obj.value}${f.area.value.trim() ? ', ' + f.area.value.trim() + ' м²' : ''}`,
        `Сроки: ${f.when.value}`,
        `Имя: ${name}`
      ];
      if (f.phone.value.trim()) lines.push(`Телефон: ${f.phone.value.trim()}`);
      if (f.comment.value.trim()) lines.push(`Комментарий: ${f.comment.value.trim()}`);
      const text = lines.join('\n');

      const url = via === 'wa'
        ? `https://wa.me/${ctx.wa}?text=${encodeURIComponent(text)}`
        : `https://t.me/${ctx.tg}` + (ctx.tgPhone ? '' : `?text=${encodeURIComponent(text)}`);
      window.open(url, '_blank', 'noopener');

      // Копия в буфер — на случай если мессенджер не подставит текст
      navigator.clipboard?.writeText(text).then(
        () => toast(via === 'wa' ? 'Открываем WhatsApp. Текст заявки также скопирован.' : (ctx.tgPhone ? 'Открываем Telegram. Текст заявки скопирован — вставьте его в чат и отправьте.' : 'Открываем Telegram. Если текст не подставился — он уже в буфере, просто вставьте его.')),
        () => toast('Открываем мессенджер…')
      );
    });
  }

  loadContent()
    .then(c => {
      const ctx = render(c);
      initHeader();
      initServices();
      initWorks();
      initReviews();
      initForm(ctx);
      initReveal();
    })
    .catch(err => {
      console.error(err);
      document.documentElement.classList.remove('js');
    });
})();
