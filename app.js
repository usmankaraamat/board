// The reader can read English but finds it slow. So nothing is translated away: the
// advert's own English words and the scanned newspaper clipping are both kept, folded
// behind a tap, and Urdu carries only the four things that decide whether to bother -
// what, where, by when, and what schooling is needed. Those come from structured fields,
// so the Urdu is assembled from known values rather than machine-translated, and cannot
// invent a deadline.
//
// Every fetch is relative, and the shapes are the same whether `server.py` is serving them
// from the database or GitHub Pages is serving them as files. The page cannot tell which,
// and that is the point: one code path rather than two that drift apart.
(() => {
  const $ = s => document.querySelector(s);
  const E = (t, x, c) => { const n = document.createElement(t); if (x != null) n.textContent = x; if (c) n.className = c; return n; };

  let PEOPLE = [];
  let WHO = null;

  // Saved jobs live on the phone rather than on a server, because once the crawl moved to
  // a scheduled build there is no server to write to - and each brother has his own phone,
  // so his saves were never anybody else's business anyway. Every read and write is
  // guarded: storage throws in a private window and comes back empty after site data is
  // cleared. Losing a save costs little, because the advert stays on the board until its
  // deadline passes either way.
  const KEY = 'naukri.saved';
  function savedSet() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
    catch (e) { return new Set(); }
  }
  function toggleSaved(url) {
    const set = savedSet();
    if (set.has(url)) { set.delete(url); } else { set.add(url); }
    try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch (e) { }
    return set.has(url);
  }

  // Warning codes are rendered here, never sent as sentences by the builder.
  const WARN = {
    money_to_a_person: 'یہ اشتہار پیسے مانگ رہا ہے۔ نوکری کے لیے کبھی پیسے نہ بھیجیں۔',
    promises_too_much: 'یہ اشتہار بہت زیادہ وعدے کر رہا ہے۔ محتاط رہیں۔',
    home_earning: 'گھر بیٹھے کمائی کا اشتہار۔ ایسے اشتہار اکثر جعلی ہوتے ہیں۔',
    personal_number_only: 'صرف ذاتی موبائل نمبر دیا گیا ہے، کوئی دفتر یا اخبار نہیں۔'
  };

  const EDU = {
    'primary': 'پرائمری', 'middle': 'مڈل', 'matric': 'میٹرک', 'ssc': 'میٹرک',
    'intermediate': 'انٹر', 'fa': 'ایف اے', 'fsc': 'ایف ایس سی', 'i.com': 'آئی کام',
    'ics': 'آئی سی ایس', 'dae': 'ڈی اے ای', 'bachelor': 'بیچلر', 'master': 'ماسٹر'
  };
  const edu = v => EDU[String(v).trim().toLowerCase()] || v;

  const MONTHS = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
  function urduDate(iso) {
    const d = new Date(iso + 'T00:00:00Z');
    if (isNaN(d)) return iso;
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  function daysLeft(iso) {
    const d = new Date(iso + 'T00:00:00Z'), now = new Date();
    const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((d.getTime() - t) / 86400000);
  }

  // A board built six hours ago can be read tomorrow, so the page recomputes the days
  // remaining rather than trusting anything the build wrote down.
  function deadlineChip(iso) {
    const n = daysLeft(iso);
    if (isNaN(n)) return null;
    let text, cls = '';
    if (n < 0) { text = 'تاریخ گزر چکی'; cls = 'today'; }
    else if (n === 0) { text = 'آج آخری دن'; cls = 'today'; }
    else if (n === 1) { text = 'کل آخری دن'; cls = 'today'; }
    else if (n <= 5) { text = n + ' دن باقی'; cls = 'soon'; }
    else { text = n + ' دن باقی'; }
    return E('span', text, 'days ' + cls);
  }

  function row(key, value) {
    const r = E('div', null, 'row');
    r.append(E('span', key, 'k'), E('span', value));
    return r;
  }

  function card(item) {
    const c = E('article', null, 'card');
    c.append(E('h2', item.title));
    if (item.organization) c.append(E('p', item.organization, 'org'));

    // One newspaper advert usually carries a whole department's vacancies, and the
    // structured title names only one of them. Showing the list is the difference between
    // "a manager's job you cannot do" and "five jobs, one of which is office boy".
    if ((item.posts || []).length > 1) {
      const box = E('div', null, 'posts');
      box.append(E('span', 'اس اشتہار میں یہ آسامیاں ہیں:', 'label'));
      const ul = document.createElement('ul');
      item.posts.forEach(p => ul.append(E('li', p)));
      box.append(ul);
      c.append(box);
    }

    const rows = E('div', null, 'rows');
    if (item.location) rows.append(row('جگہ', item.location));
    const levels = (item.education || []).map(edu).join('، ');
    rows.append(row('تعلیم', levels || 'اشتہار میں نہیں لکھی'));
    if (item.deadline) {
      const r = E('div', null, 'row');
      r.append(E('span', 'آخری تاریخ', 'k'), E('span', urduDate(item.deadline) + '  '));
      const chip = deadlineChip(item.deadline);
      if (chip) r.append(chip);
      rows.append(r);
    } else {
      rows.append(row('آخری تاریخ', 'اشتہار میں نہیں لکھی'));
    }
    if (item.salary > 0) rows.append(row('تنخواہ', item.salary.toLocaleString('en-US') + ' روپے'));
    c.append(rows);

    (item.warnings || []).forEach(w => {
      const text = WARN[w.code];
      if (text) c.append(E('div', text, 'warn'));
    });

    if (item.description) {
      const box = document.createElement('details');
      box.className = 'english';
      const head = document.createElement('summary');
      head.textContent = 'اشتہار کے اپنے الفاظ (انگریزی میں)';
      box.append(head, E('p', item.description, 'en-body'));
      c.append(box);
    }

    const acts = E('div', null, 'acts');
    const open = E('a', 'اشتہار کھولیں', 'primary');
    open.href = item.url; open.target = '_blank'; open.rel = 'noopener';
    acts.append(open);

    let saved = savedSet().has(item.url);
    const save = E('button', saved ? 'محفوظ ہے' : 'محفوظ کریں');
    save.setAttribute('aria-pressed', saved ? 'true' : 'false');
    save.onclick = () => {
      saved = toggleSaved(item.url);
      save.setAttribute('aria-pressed', saved ? 'true' : 'false');
      save.textContent = saved ? 'محفوظ ہے' : 'محفوظ کریں';
    };
    acts.append(save);
    c.append(acts);

    if (item.image) {
      const box = document.createElement('details');
      box.className = 'shotbox';
      const head = document.createElement('summary');
      head.textContent = 'اخبار والا اشتہار دیکھیں';
      const img = document.createElement('img');
      img.src = item.image; img.className = 'shot'; img.loading = 'lazy';
      img.alt = 'اخبار کا اشتہار';
      box.append(head, img);
      c.append(box);
    }
    return c;
  }

  async function load() {
    const list = $('#list');
    list.replaceChildren();
    $('#count').textContent = 'لوڈ ہو رہا ہے…';
    try {
      const r = await fetch('board-' + WHO + '.json', { cache: 'no-cache' });
      if (!r.ok) throw Error('board');
      const data = await r.json();
      const items = data.items || [];
      $('#count').textContent = (data.label || '') + ' کے لیے ' + items.length + ' نوکریاں';
      if (!items.length) {
        list.append(E('div', 'ابھی کوئی نئی نوکری نہیں ملی۔ کل دوبارہ دیکھیں۔', 'empty'));
      } else {
        items.forEach(i => list.append(card(i)));
      }
      $('#foot').textContent = data.checked_at
        ? 'آخری بار دیکھا گیا: ' + urduDate(data.checked_at.slice(0, 10))
        : '';
    } catch (e) {
      $('#count').textContent = '';
      list.append(E('div', 'ابھی رابطہ نہیں ہو سکا۔ تھوڑی دیر بعد کوشش کریں۔', 'empty'));
    }
  }

  function pick(who) {
    WHO = who;
    try { localStorage.setItem('naukri.who', who); } catch (e) { }
    $('#who').querySelectorAll('button').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.id === who ? 'true' : 'false');
    });
    load();
  }

  // The toggle is built from the data, so the only place either name is written down is
  // people.json - one file to edit if they would rather not be named at all.
  async function start() {
    try {
      const r = await fetch('people.json', { cache: 'no-cache' });
      PEOPLE = await r.json();
    } catch (e) {
      PEOPLE = [];
    }
    const bar = $('#who');
    bar.replaceChildren();
    PEOPLE.forEach(p => {
      const b = E('button', p.label);
      b.dataset.id = p.id;
      b.setAttribute('aria-pressed', 'false');
      b.onclick = () => pick(p.id);
      bar.append(b);
    });
    if (!PEOPLE.length) {
      $('#count').textContent = '';
      $('#list').append(E('div', 'ابھی رابطہ نہیں ہو سکا۔ تھوڑی دیر بعد کوشش کریں۔', 'empty'));
      return;
    }
    let remembered = null;
    try { remembered = localStorage.getItem('naukri.who'); } catch (e) { }
    pick(PEOPLE.some(p => p.id === remembered) ? remembered : PEOPLE[0].id);
  }

  // Installing it. Chrome and the Android browsers fire beforeinstallprompt and the
  // button appears; iOS Safari does not support it at all, so there the same button shows
  // the two steps to do it by hand rather than pretending the feature is missing.
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  let deferred = null;

  function showInstall(mode) {
    const bar = $('#install');
    if (!bar || standalone) return;
    bar.hidden = false;
    bar.replaceChildren();
    if (mode === 'prompt') {
      const b = E('button', 'فون میں ایپ کے طور پر لگائیں');
      b.onclick = async () => {
        if (!deferred) return;
        bar.hidden = true;
        deferred.prompt();
        try { await deferred.userChoice; } catch (e) { }
        deferred = null;
      };
      bar.append(b);
    } else {
      bar.append(E('p', 'اسے ایپ کی طرح لگانے کے لیے: نیچے شیئر کا بٹن دبائیں، پھر ”Add to Home Screen“ چنیں۔', 'hint'));
    }
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    showInstall('prompt');
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    const bar = $('#install');
    if (bar) bar.hidden = true;
  });
  if (isIOS) showInstall('ios');

  if ('serviceWorker' in navigator) {
    // Registered relatively so the scope is wherever the site is published, which on Pages
    // is a repository subpath rather than the domain root.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    });
  }

  start();
})();
