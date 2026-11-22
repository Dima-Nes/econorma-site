/* ЭкоНорма v2 – interactive UI controller
   Handles: reading progress & scroll-spy, hero role router & 4-tab A4 dossier,
   interactive 77-institution district status board, A4 samples gallery & modal with zoom + focus-trap,
   interactive Zavhoz checklist (localStorage), smart 1-minute self-check & cost estimator,
   searchable waste classifier with 1-click code copy, pricing mode switcher,
   one-click tender requisites copy, mobile nav & sticky dock, and non-destructive lead form. */
(function () {
  var DOCS = window.ECONORMA_DOCS || [];
  var EXTRA = window.ECONORMA_EXTRA_DOCS || {};
  var LEAD_ENDPOINT = '';   // Подключите URL webhook (Telegram-бот / CRM) при публикации
  var TELEGRAM_HANDLE = ''; // При наличии укажите ник Telegram без @ (например, 'econorma_by')

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function createPaper(html) {
    var el = document.createElement('div');
    el.className = 'doc-paper';
    el.innerHTML = html;
    return el;
  }

  function smoothScrollTo(el) {
    if (!el) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }

  /* Toast notification (accessible aria-live) */
  var toastTimer = null;
  function showToast(msg) {
    var toast = $('statusLive');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2500);
  }

  function copyText(text, label) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(label || 'Скопировано');
      }).catch(function () {
        fallbackCopy(text, label);
      });
    } else {
      fallbackCopy(text, label);
    }
  }

  function fallbackCopy(text, label) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(label || 'Скопировано');
    } catch (e) {
      showToast('Не удалось скопировать автоматически');
    }
    document.body.removeChild(ta);
  }

  function downloadTextFile(filename, text) {
    try {
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast('Файл заявки сохранён');
    } catch (e) {
      showToast('Не удалось сохранить файл');
    }
  }

  /* Prefill lead form helper (also restores form if previously submitted) */
  function prefillForm(countText, msgText) {
    var form = $('leadForm');
    var success = $('formSuccess');
    if (!form) return;

    if (success && !success.hidden) {
      success.hidden = true;
      form.hidden = false;
    }

    if (countText && form.objects) {
      for (var i = 0; i < form.objects.options.length; i++) {
        if (form.objects.options[i].text === countText || form.objects.options[i].value === countText) {
          form.objects.selectedIndex = i;
          break;
        }
      }
    }
    if (msgText && form.comment) {
      form.comment.value = msgText;
    }
    smoothScrollTo($('contact'));
    if (form.org) {
      setTimeout(function () {
        form.org.focus({ preventScroll: true });
      }, 320);
    }
  }

  /* 0. READING PROGRESS, SCROLL-SPY & MOBILE DOCK */
  function initNavigationEnhancements() {
    var progressBar = $('readProgress');
    var dock = $('mobileDock');
    var hero = document.querySelector('.hero');
    var contact = $('contact');

    function onScroll() {
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docH > 0 ? Math.min(100, Math.max(0, (window.scrollY / docH) * 100)) : 0;
      if (progressBar) progressBar.style.width = pct.toFixed(1) + '%';

      if (dock && hero) {
        var pastHero = window.scrollY > Math.max(260, hero.offsetHeight - 120);
        var inContact = contact ? (contact.getBoundingClientRect().top < window.innerHeight - 100) : false;
        dock.classList.toggle('is-visible', pastHero && !inContact);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.main-nav a[href^="#"]'));
    if (!navLinks.length || !('IntersectionObserver' in window)) return;

    var sections = navLinks.map(function (a) {
      return document.querySelector(a.getAttribute('href'));
    }).filter(Boolean);

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = '#' + entry.target.id;
          navLinks.forEach(function (a) {
            a.classList.toggle('is-current', a.getAttribute('href') === id);
          });
        }
      });
    }, { rootMargin: '-28% 0px -58% 0px', threshold: 0 });

    sections.forEach(function (sec) { observer.observe(sec); });
  }

  /* 1. HERO INTERACTIVE DOSSIER & ROLE ROUTER */
  var heroDocIds = ['school', 'clinic', 'sto', 'center'];
  var activeHeroId = 'school';

  function findDocById(id) {
    if (EXTRA[id]) return { doc: EXTRA[id], index: -1 };
    for (var i = 0; i < DOCS.length; i++) {
      if (DOCS[i].id === id) return { doc: DOCS[i], index: i };
    }
    return null;
  }

  function renderHeroDoc(id) {
    var stage = $('heroStage');
    var scaleWrap = $('heroScale');
    if (!stage || !scaleWrap) return;
    var found = findDocById(id);
    if (!found) return;

    activeHeroId = id;
    scaleWrap.innerHTML = '';
    scaleWrap.appendChild(createPaper(found.doc.html));

    var caption = $('heroDocCaption');
    if (caption) {
      caption.textContent = 'Демонстрационный образец · ' + found.doc.sphere;
    }

    document.querySelectorAll('.dossier-tab').forEach(function (tab) {
      var selected = tab.getAttribute('data-hero-doc') === id;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    });

    fitHeroScale();
  }

  function fitHeroScale() {
    var stage = $('heroStage');
    var scaleWrap = $('heroScale');
    if (!stage || !scaleWrap) return;
    var s = stage.clientWidth / 794;
    scaleWrap.style.transform = 'scale(' + s + ')';
  }

  function initHeroDossier() {
    var tabsWrap = $('heroTabs');
    if (!tabsWrap) return;
    heroDocIds.forEach(function (id, idx) {
      var found = findDocById(id);
      if (!found) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dossier-tab';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      btn.setAttribute('data-hero-doc', id);
      btn.textContent = found.doc.sphere;
      btn.addEventListener('click', function () {
        renderHeroDoc(id);
      });
      tabsWrap.appendChild(btn);
    });

    var stage = $('heroStage');
    var openBtn = $('heroOpenDoc');
    if (stage) {
      stage.addEventListener('click', function () {
        openDocById(activeHeroId);
      });
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDocById(activeHeroId);
        }
      });
    }
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        openDocById(activeHeroId);
      });
    }

    renderHeroDoc(heroDocIds[0]);

    /* Role Quick-Router */
    document.querySelectorAll('.role-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        var role = pill.getAttribute('data-role');
        if (role === 'school') {
          setCalculatorPreset('school', 1, true, false);
          renderHeroDoc('school');
          smoothScrollTo($('check'));
        } else if (role === 'center') {
          setCalculatorPreset('center', 100, true, false);
          renderHeroDoc('center');
          smoothScrollTo($('district-board'));
        } else if (role === 'clinic') {
          setCalculatorPreset('clinic', 1, false, false);
          renderHeroDoc('clinic');
          smoothScrollTo($('check'));
        } else if (role === 'business') {
          setCalculatorPreset('sto', 1, false, true);
          renderHeroDoc('sto');
          smoothScrollTo($('check'));
        }
      });
    });
  }

  /* 2. INTERACTIVE DISTRICT STATUS BOARD (100 INSTITUTIONS DEMO) */
  var BOARD_ROWS = [
    { no: 1,  name: 'ГУО «Средняя школа № 11»',          stage: 'Этап 1', date: '04.12.2026', status: 'Утверждено',     cls: 'ok' },
    { no: 2,  name: 'ГУО «Ясли-сад № 24»',                stage: 'Этап 1', date: '04.12.2026', status: 'Утверждено',     cls: 'ok' },
    { no: 3,  name: 'ГУО «Гимназия № 7»',                 stage: 'Этап 1', date: '05.12.2026', status: 'Утверждено',     cls: 'ok' },
    { no: 4,  name: 'ГУО «Детский сад № 38»',             stage: 'Этап 1', date: '05.12.2026', status: 'Утверждено',     cls: 'ok' },
    { no: 5,  name: 'ГУО «Средняя школа № 19»',           stage: 'Этап 2', date: '08.12.2026', status: 'На утверждении', cls: 'ok' },
    { no: 6,  name: 'ГУО «Ясли-сад № 41»',                stage: 'Этап 2', date: '08.12.2026', status: 'На утверждении', cls: 'ok' },
    { no: 7,  name: 'ГУО «Центр дополнительного образ. № 2»', stage: 'Этап 2', date: '09.12.2026', status: 'На утверждении', cls: 'ok' },
    { no: 8,  name: 'ГУО «Средняя школа № 54»',           stage: 'Этап 3', date: '11.12.2026', status: 'Разработка',     cls: 'mid' },
    { no: 9,  name: 'ГУО «Детский сад № 62»',             stage: 'Этап 3', date: '11.12.2026', status: 'Разработка',     cls: 'mid' },
    { no: 10, name: 'ГУО «Ясли-сад № 75»',                stage: 'Этап 3', date: '12.12.2026', status: 'Разработка',     cls: 'mid' },
    { no: 11, name: 'ГУО «Гимназия № 17»',                stage: 'Этап 4', date: '15.12.2026', status: 'Разработка',     cls: 'mid' },
    { no: 12, name: 'ГУО «Средняя школа № 83»',           stage: 'Этап 4', date: '15.12.2026', status: 'Обследование',   cls: 'mid' },
    { no: 13, name: 'ГУО «Детский сад № 91»',             stage: 'Этап 4', date: '16.12.2026', status: 'Обследование',   cls: 'mid' },
    { no: 14, name: 'ГУО «Центр творчества № 3»',         stage: 'Этап 5', date: '17.12.2026', status: 'Обследование',   cls: 'mid' },
    { no: 15, name: 'ГУО «Средняя школа № 112»',          stage: 'Этап 5', date: '18.12.2026', status: 'Обследование',   cls: 'mid' },
    { no: 16, name: 'ГУО «Ясли-сад № 108»',               stage: 'Этап 5', date: '19.12.2026', status: 'Сбор данных',    cls: 'wait' },
    { no: 17, name: 'ГУО «Детский сад № 119»',            stage: 'Этап 6', date: '21.12.2026', status: 'Сбор данных',    cls: 'wait' },
    { no: 18, name: 'ГУО «Средняя школа № 134»',          stage: 'Этап 6', date: '22.12.2026', status: 'Сбор данных',    cls: 'wait' },
    { no: 19, name: 'ГУО «Специальный сад № 5»',          stage: 'Этап 6', date: '22.12.2026', status: 'Сбор данных',    cls: 'wait' },
    { no: 20, name: 'ГУО «Физкультурно-спортивный центр»', stage: 'Этап 6', date: '23.12.2026', status: 'Утверждено',    cls: 'ok' }
  ];

  function initDistrictBoard() {
    var filtersWrap = $('boardFilters');
    var tbody = $('boardTbody');
    var searchInput = $('boardSearch');
    var toggleMore = $('boardToggleMore');
    var note = $('boardCountNote');
    if (!filtersWrap || !tbody) return;

    var statuses = ['Все', 'Утверждено', 'На утверждении', 'Разработка', 'Обследование', 'Сбор данных'];
    var activeStatus = 'Все';
    var expanded = false;

    statuses.forEach(function (st, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn' + (idx === 0 ? ' is-active' : '');
      btn.textContent = st;
      btn.addEventListener('click', function () {
        activeStatus = st;
        filtersWrap.querySelectorAll('.chip-btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderBoard();
      });
      filtersWrap.appendChild(btn);
    });

    function renderBoard() {
      var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
      var filtered = BOARD_ROWS.filter(function (row) {
        var matchSt = activeStatus === 'Все' || row.status === activeStatus;
        var matchQ = !q ||
          row.name.toLowerCase().indexOf(q) !== -1 ||
          row.stage.toLowerCase().indexOf(q) !== -1 ||
          row.status.toLowerCase().indexOf(q) !== -1;
        return matchSt && matchQ;
      });

      var limit = (expanded || q || activeStatus !== 'Все') ? filtered.length : 8;
      var shown = filtered.slice(0, limit);

      if (!shown.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty">По вашему запросу записи в выборке не найдены.</td></tr>';
      } else {
        tbody.innerHTML = shown.map(function (r) {
          return '<tr>' +
            '<td class="mono">' + r.no + '</td>' +
            '<td>' + escapeHtml(r.name) + '</td>' +
            '<td>' + escapeHtml(r.stage) + '</td>' +
            '<td class="mono">' + escapeHtml(r.date) + '</td>' +
            '<td><span class="st-badge ' + r.cls + '">' + escapeHtml(r.status) + '</span></td>' +
          '</tr>';
        }).join('');
      }

      if (note) {
        note.textContent = 'Показано ' + shown.length + ' из ' + filtered.length + ' записей демонстрационной выборки (полный реестр – 100 учреждений).';
      }
      if (toggleMore) {
        toggleMore.hidden = (filtered.length <= 8 || Boolean(q) || activeStatus !== 'Все');
        toggleMore.textContent = expanded ? 'Свернуть до 8 записей' : 'Показать все ' + filtered.length + ' записей';
      }
    }

    if (searchInput) searchInput.addEventListener('input', renderBoard);
    if (toggleMore) {
      toggleMore.addEventListener('click', function () {
        expanded = !expanded;
        renderBoard();
      });
    }

    renderBoard();
  }

  /* 3. DOCUMENT SAMPLES GALLERY */
  function initDocGallery() {
    var filterWrap = $('docFilters');
    var grid = $('docGrid');
    if (!filterWrap || !grid) return;

    var spheres = ['Все'].concat(DOCS.map(function (d) { return d.sphere; }));
    spheres.forEach(function (sphere, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-tab' + (idx === 0 ? ' is-active' : '');
      btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
      btn.textContent = idx === 0 ? 'Все (' + DOCS.length + ')' : sphere;
      btn.addEventListener('click', function () {
        filterWrap.querySelectorAll('.filter-tab').forEach(function (b) {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        grid.querySelectorAll('.doc-card').forEach(function (card) {
          var match = sphere === 'Все' || card.getAttribute('data-sphere') === sphere;
          card.hidden = !match;
        });
        fitThumbScales();
      });
      filterWrap.appendChild(btn);
    });

    DOCS.forEach(function (d, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'doc-card';
      btn.setAttribute('data-sphere', d.sphere);
      btn.setAttribute('aria-label', 'Открыть образец: ' + d.title);

      var thumb = document.createElement('div');
      thumb.className = 'doc-card-thumb';
      thumb.appendChild(createPaper(d.html));

      var info = document.createElement('div');
      info.className = 'doc-card-info';
      info.innerHTML =
        '<span class="doc-card-meta">' + escapeHtml(d.sphere + ' · ' + d.type) + '</span>' +
        '<span class="doc-card-title">' + escapeHtml(d.title) + '</span>' +
        '<span class="doc-card-action">Открыть образец →</span>';

      btn.appendChild(thumb);
      btn.appendChild(info);
      btn.addEventListener('click', function () {
        openDocIndex(idx);
      });
      grid.appendChild(btn);
    });

    fitThumbScales();
  }

  function fitThumbScales() {
    document.querySelectorAll('.doc-card-thumb').forEach(function (thumb) {
      if (!thumb.clientWidth) return;
      var paper = thumb.querySelector('.doc-paper');
      if (!paper) return;
      var s = thumb.clientWidth / 794;
      paper.style.transform = 'scale(' + s + ')';
    });
  }

  /* 4. DOCUMENT READER MODAL (Zoom + Counter + Focus-Trap + Mobile Action Bar) */
  var currentModalIndex = -1;
  var currentModalDoc = null;
  var lastFocusedEl = null;
  var modalZoomMode = 'fit'; // 'fit' or numeric multiplier (0.75 .. 1.35)

  function openDocById(id) {
    var found = findDocById(id);
    if (!found) return;
    if (found.index >= 0) {
      openDocIndex(found.index);
    } else {
      showModalDoc(found.doc, -1);
    }
  }

  function openDocIndex(idx) {
    if (!DOCS.length) return;
    var safeIdx = (idx + DOCS.length) % DOCS.length;
    showModalDoc(DOCS[safeIdx], safeIdx);
  }

  function showModalDoc(doc, idx) {
    var modal = $('docModal');
    var body = $('modalBody');
    if (!modal || !body) return;

    if (!modal.classList.contains('is-open')) {
      lastFocusedEl = document.activeElement;
    }

    currentModalIndex = idx;
    currentModalDoc = doc;
    modalZoomMode = 'fit';

    $('modalType').textContent = doc.sphere + ' · ' + doc.type;
    $('modalTitle').textContent = doc.title;

    var counter = $('modalCounter');
    if (counter) {
      counter.textContent = idx >= 0 ? ((idx + 1) + ' / ' + DOCS.length) : 'Доп. бланк';
    }

    var prevBtn = $('modalPrev');
    var nextBtn = $('modalNext');
    var showNav = idx >= 0;
    if (prevBtn) prevBtn.hidden = !showNav;
    if (nextBtn) nextBtn.hidden = !showNav;

    body.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'modal-scale';
    wrap.appendChild(createPaper(doc.html));
    body.appendChild(wrap);

    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    fitModalScale();
    body.scrollTop = 0;

    var closeBtn = $('modalClose');
    if (closeBtn) closeBtn.focus();
  }

  function getFitScale() {
    var body = $('modalBody');
    if (!body) return 1;
    var avail = Math.max(280, body.clientWidth - 28);
    return Math.min(1, avail / 794);
  }

  function fitModalScale() {
    var body = $('modalBody');
    if (!body) return;
    var wrap = body.querySelector('.modal-scale');
    if (!wrap) return;
    var paper = wrap.firstChild;
    if (!paper) return;

    var s = modalZoomMode === 'fit' ? getFitScale() : modalZoomMode;
    paper.style.transform = 'scale(' + s + ')';
    wrap.style.width = Math.round(794 * s) + 'px';
    wrap.style.height = Math.round(paper.offsetHeight * s) + 'px';

    var fitBtn = $('zoomFit');
    if (fitBtn) {
      fitBtn.textContent = modalZoomMode === 'fit' ? 'Авто' : Math.round(s * 100) + '%';
    }
  }

  function closeModal() {
    var modal = $('docModal');
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      lastFocusedEl.focus();
    }
  }

  function initModal() {
    var modal = $('docModal');
    if (!modal) return;

    function triggerCta() {
      var doc = currentModalDoc;
      closeModal();
      if (doc) {
        prefillForm(doc.ctaCount || '1 объект', doc.ctaMsg || ('Запрос по образцу: ' + doc.title));
      }
    }

    $('modalClose').addEventListener('click', closeModal);
    $('modalPrev').addEventListener('click', function () {
      if (currentModalIndex >= 0) openDocIndex(currentModalIndex - 1);
    });
    $('modalNext').addEventListener('click', function () {
      if (currentModalIndex >= 0) openDocIndex(currentModalIndex + 1);
    });
    $('modalPrint').addEventListener('click', function () { window.print(); });
    $('modalCta').addEventListener('click', triggerCta);

    var printMob = $('modalPrintMob');
    var ctaMob = $('modalCtaMob');
    if (printMob) printMob.addEventListener('click', function () { window.print(); });
    if (ctaMob) ctaMob.addEventListener('click', triggerCta);

    var zoomOut = $('zoomOut');
    var zoomFit = $('zoomFit');
    var zoomIn = $('zoomIn');
    if (zoomOut) {
      zoomOut.addEventListener('click', function () {
        var cur = modalZoomMode === 'fit' ? getFitScale() : modalZoomMode;
        modalZoomMode = Math.max(0.65, Math.round((cur - 0.12) * 100) / 100);
        fitModalScale();
      });
    }
    if (zoomFit) {
      zoomFit.addEventListener('click', function () {
        modalZoomMode = 'fit';
        fitModalScale();
      });
    }
    if (zoomIn) {
      zoomIn.addEventListener('click', function () {
        var cur = modalZoomMode === 'fit' ? getFitScale() : modalZoomMode;
        modalZoomMode = Math.min(1.35, Math.round((cur + 0.12) * 100) / 100);
        fitModalScale();
      });
    }

    modal.addEventListener('click', function (e) {
      if (e.target === $('modalBody')) closeModal();
    });

    /* Keyboard navigation + Focus Trap */
    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'ArrowRight' && currentModalIndex >= 0) {
        openDocIndex(currentModalIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentModalIndex >= 0) {
        openDocIndex(currentModalIndex - 1);
      } else if (e.key === 'Tab') {
        var focusables = Array.prototype.slice.call(
          modal.querySelectorAll('button:not([hidden]):not([disabled]), a[href]')
        ).filter(function (el) { return el.offsetParent !== null; });
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    document.querySelectorAll('[data-open-doc]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openDocById(el.getAttribute('data-open-doc'));
      });
    });
  }

  /* 5. INTERACTIVE ZAVHOZ READINESS CHECKLIST */
  var ZAVHOZ_ITEMS = [
    'Карточка организации (наименование, УНП, адрес, ОКЭД, ФИО руководителя)',
    'Штатная численность работников (и учащихся/воспитанников) + площадь территории',
    'Предыдущая инструкция по обращению с отходами и акт инвентаризации (если есть)',
    'Приказы о назначении ответственных за обращение с отходами и ведение учёта',
    'Договор на вывоз ТКО и акты/накладные за последние 12 месяцев',
    'Договоры/акты на передачу ртутных ламп, батареек и списанной оргтехники',
    'Договоры/накладные на сдачу макулатуры, картона и металлолома',
    'Сведения о количестве люминесцентных/светодиодных ламп и оргтехники',
    'Сведения по пищеблоку / столовой и договору на пищевые отходы (если есть)',
    'Сведения по собственному автотранспорту: масла, фильтры, шины, АКБ (если есть)'
  ];
  var ZAVHOZ_STORAGE_KEY = 'econorma_zavhoz_v2';

  function initZavhozChecklist() {
    var grid = $('zavhozGrid');
    if (!grid) return;

    var state = [];
    try {
      var saved = JSON.parse(localStorage.getItem(ZAVHOZ_STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) state = saved;
    } catch (e) {
      state = [];
    }

    function saveState() {
      try {
        localStorage.setItem(ZAVHOZ_STORAGE_KEY, JSON.stringify(state));
      } catch (e) {}
    }

    function updateProgress() {
      var doneCount = state.filter(Boolean).length;
      var total = ZAVHOZ_ITEMS.length;
      var pct = Math.round((doneCount / total) * 100);
      var txt = $('zavhozProgressText');
      var fill = $('zavhozProgressFill');
      if (txt) txt.textContent = doneCount + ' из ' + total;
      if (fill) fill.style.width = pct + '%';
    }

    grid.innerHTML = '';
    ZAVHOZ_ITEMS.forEach(function (labelText, idx) {
      var checked = Boolean(state[idx]);
      var row = document.createElement('label');
      row.className = 'zavhoz-item' + (checked ? ' is-done' : '');

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.addEventListener('change', function () {
        state[idx] = input.checked;
        row.classList.toggle('is-done', input.checked);
        saveState();
        updateProgress();
      });

      var span = document.createElement('span');
      span.textContent = labelText;

      row.appendChild(input);
      row.appendChild(span);
      grid.appendChild(row);
    });

    updateProgress();

    var copyMissing = $('zavhozCopyMissing');
    if (copyMissing) {
      copyMissing.addEventListener('click', function () {
        var missing = ZAVHOZ_ITEMS.filter(function (_, idx) { return !state[idx]; });
        if (!missing.length) {
          showToast('Все 10 пунктов чек-листа уже отмечены');
          return;
        }
        var text = 'Недостающие первичные данные для инструкции (ЭкоНорма):\n- ' + missing.join('\n- ');
        copyText(text, 'Список недостающих пунктов (' + missing.length + ') скопирован');
      });
    }

    var toForm = $('zavhozToForm');
    if (toForm) {
      toForm.addEventListener('click', function () {
        var doneCount = state.filter(Boolean).length;
        var missingCount = ZAVHOZ_ITEMS.length - doneCount;
        var msg = 'Чек-лист первички: готово ' + doneCount + ' из ' + ZAVHOZ_ITEMS.length + ' пунктов';
        if (missingCount > 0) msg += ' (по ' + missingCount + ' пунктам нужна помощь/уточнение)';
        prefillForm('1 объект', msg);
      });
    }

    var resetBtn = $('zavhozReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        state = [];
        saveState();
        grid.querySelectorAll('.zavhoz-item').forEach(function (row) {
          row.classList.remove('is-done');
          var cb = row.querySelector('input');
          if (cb) cb.checked = false;
        });
        updateProgress();
        showToast('Отметки чек-листа сброшены');
      });
    }
  }

  /* 6. SMART SELF-CHECK & COST ESTIMATOR */
  var lastCheckResult = { countText: '1 объект', summary: '' };

  function setCalculatorPreset(typeVal, countVal, foodBool, carBool) {
    var typeEl = $('qType');
    var numEl = $('qCountNum');
    var rngEl = $('qCountRange');
    var foodEl = $('qFood');
    var carEl = $('qCar');
    if (typeEl) typeEl.value = typeVal;
    if (numEl) numEl.value = countVal;
    if (rngEl) rngEl.value = Math.min(100, countVal);
    if (foodEl) foodEl.checked = Boolean(foodBool);
    if (carEl) carEl.checked = Boolean(carBool);
    updateChecker();
  }

  function mapCountToFormOption(n) {
    if (n <= 1) return '1 объект';
    if (n <= 10) return '2–10 объектов';
    if (n <= 30) return '11–30 объектов';
    return 'более 30 объектов';
  }

  function updateChecker() {
    var typeEl = $('qType');
    var yearEl = $('qYear');
    var numEl = $('qCountNum');
    var foodEl = $('qFood');
    var carEl = $('qCar');
    var subEl = $('qSub');
    var out = $('checkerOutput');
    if (!typeEl || !yearEl || !numEl || !out) return;

    var orgType = typeEl.value;
    var orgTypeLabel = typeEl.options[typeEl.selectedIndex].text;
    var y = yearEl.value;
    var count = Math.max(1, Math.min(200, parseInt(numEl.value, 10) || 1));
    var hasFood = foodEl && foodEl.checked;
    var hasCar = carEl && carEl.checked;
    var wantSub = subEl && subEl.checked;

    var statusCode = 'Вывод проверки';
    var title = '';
    var summary = '';

    if (y === 'none') {
      statusCode = 'Требуется разработка';
      title = 'Нужна разработка новой инструкции';
      summary = 'Без утверждённой инструкции организация не выполняет требования Закона № 271-З. Подготовим пакет с выездом, инвентаризацией и расчётом нормативов.';
    } else if (y === 'old') {
      statusCode = 'Срок истёк или истекает';
      title = 'Пора продлевать инструкцию';
      summary = 'Пятилетний срок действия инструкции закончился или подходит к концу. Потребуется актуализация инвентаризации и утверждение новой редакции.';
    } else if (y === 'mid') {
      statusCode = 'Приоритет на 2027 год';
      title = 'Продление предстоит в 2027 году';
      summary = 'Инструкции 2022 года истекают в 2027 году. Рекомендуем заранее включить работы в план закупок на 2027 год и зафиксировать график.';
    } else {
      statusCode = 'Инструкция действует';
      title = 'Документ в пределах пятилетнего срока';
      summary = 'Если состав отходов, оборудование, транспорт или площади не менялись – достаточно вести книги учёта ПОД-9 и ПОД-10. При изменениях нужна корректировка.';
    }

    var notes = [];
    if (orgType === 'school') {
      notes.push('Бюджетное учреждение образования: типовой пакет включает лампы, технику, макулатуру, смёт и ТКО; отчёт «1-отходы» обычно не требуется.');
    } else if (orgType === 'center') {
      notes.push('Центр обеспечения: единый договор, онлайн-реестр статусов по учреждениям, поэтапная сдача партиями и актирование.');
    } else if (orgType === 'clinic') {
      notes.push('Медучреждение: учтём специфику кабинетов, раздельного сбора и нормативов образования.');
    } else if (orgType === 'sto') {
      notes.push('СТО / производство: включим раздел по маслам, фильтрам, шинам, АКБ, а при необходимости – отчёт «1-отходы» и экологический налог.');
    }

    if (hasFood) {
      notes.push('Пищеблок / столовая: пропишем раздельный сбор пищевых отходов и порядок их передачи.');
    }
    if (hasCar && orgType !== 'sto') {
      notes.push('Автотранспорт на балансе: добавим отдельный блок по отработанным маслам, фильтрам, шинам и аккумуляторам.');
    }
    if (wantSub) {
      notes.push('Экосопровождение: от 120 до 300 BYN/мес. (календарь сроков, книги ПОД-9/ПОД-10, ответы на запросы органов).');
    }

    /* Realistic pricing & timeline based on Business Plan v2 */
    var priceLabel = 'Ориентир бюджета';
    var priceVal = '';
    var priceSub = '';
    var termVal = '';
    var termSub = 'Согласование в органах (до 25 дн.) – отдельно';

    if (y === 'new') {
      priceLabel = wantSub ? 'Абонемент ПОД' : 'Проверка актуальности';
      priceVal = wantSub ? '120–300 BYN / мес.' : 'Бесплатная консультация';
      priceSub = wantSub ? '3 тарифа: Базовый, Стандарт, Полный' : 'Сверим перечень отходов с действующим пакетом';
      termVal = '1–2 рабочих дня';
      termSub = 'Без выезда или по чек-листу';
    } else if (count === 1) {
      var minSingle = 450 + (hasCar ? 50 : 0);
      var maxSingle = 650 + (hasCar ? 100 : 0);
      priceVal = 'от ' + minSingle + ' BYN';
      priceSub = 'Обычно ' + minSingle + '–' + maxSingle + ' BYN за полный пакет' + (wantSub ? ' + абонемент от 120 BYN/мес.' : '');
      termVal = 'от 5 раб. дней';
    } else if (count <= 10) {
      var low10 = count * 320;
      var high10 = count * 420;
      priceVal = '320–420 BYN / объект';
      priceSub = 'Ориентир на ' + count + ' объектов: ~' + low10.toLocaleString('ru-RU') + '–' + high10.toLocaleString('ru-RU') + ' BYN';
      termVal = '1–2 недели';
    } else {
      var lowPkg = count * 230;
      var highPkg = count * 300;
      priceVal = '230–300 BYN / объект';
      priceSub = 'Пакет на ' + count + ' объектов: ~' + lowPkg.toLocaleString('ru-RU') + '–' + highPkg.toLocaleString('ru-RU') + ' BYN';
      termVal = count > 30 ? 'от 4 недель (партиями)' : '2–4 недели (партиями)';
    }

    var summaryParts = [
      orgTypeLabel,
      count + ' объект(ов)',
      title
    ];
    if (hasFood) summaryParts.push('есть пищеблок');
    if (hasCar) summaryParts.push('есть автотранспорт');
    if (wantSub) summaryParts.push('интересует абонемент ПОД');

    lastCheckResult = {
      countText: mapCountToFormOption(count),
      summary: summaryParts.join('; ')
    };

    var notesHtml = notes.length
      ? '<ul class="checker-notes">' + notes.map(function (t) { return '<li><span>' + escapeHtml(t) + '</span></li>'; }).join('') + '</ul>'
      : '';

    out.innerHTML =
      '<div>' +
        '<div class="checker-status">' + escapeHtml(statusCode) + '</div>' +
        '<h3 class="checker-title">' + escapeHtml(title) + '</h3>' +
        '<p class="checker-summary">' + escapeHtml(summary) + '</p>' +
        notesHtml +
      '</div>' +
      '<div>' +
        '<div class="checker-metrics">' +
          '<div>' +
            '<div class="checker-price-label">' + escapeHtml(priceLabel) + '</div>' +
            '<div class="checker-price-val">' + escapeHtml(priceVal) + '</div>' +
            '<div class="checker-sub-val">' + escapeHtml(priceSub) + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="checker-price-label">Срок разработки</div>' +
            '<div class="checker-price-val">' + escapeHtml(termVal) + '</div>' +
            '<div class="checker-sub-val">' + escapeHtml(termSub) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="checker-actions">' +
          '<button type="button" class="btn btn-dark-primary" id="applyCheckBtn">Перенести расчёт в форму КП</button>' +
          '<button type="button" class="btn btn-dark-ghost" id="openCheckSampleBtn">Смотреть образец</button>' +
        '</div>' +
      '</div>';

    var applyBtn = $('applyCheckBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        prefillForm(lastCheckResult.countText, lastCheckResult.summary);
      });
    }
    var sampleBtn = $('openCheckSampleBtn');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        var sampleId = 'school';
        if (orgType === 'center' || count >= 15) sampleId = 'center';
        else if (orgType === 'clinic') sampleId = 'clinic';
        else if (orgType === 'sto' || hasCar) sampleId = 'sto';
        else if (orgType === 'office' && hasFood) sampleId = 'cafe';
        openDocById(sampleId);
      });
    }
  }

  function initChecker() {
    var rng = $('qCountRange');
    var num = $('qCountNum');
    var typeEl = $('qType');

    if (rng && num) {
      rng.addEventListener('input', function () {
        num.value = rng.value;
        updateChecker();
      });
      num.addEventListener('input', function () {
        var v = Math.max(1, Math.min(200, parseInt(num.value, 10) || 1));
        rng.value = Math.min(100, v);
        updateChecker();
      });
    }

    if (typeEl) {
      typeEl.addEventListener('change', function () {
        if (typeEl.value === 'center' && num && parseInt(num.value, 10) < 10) {
          num.value = 30;
          if (rng) rng.value = 30;
        }
        if (typeEl.value === 'sto' && $('qCar')) {
          $('qCar').checked = true;
        }
        updateChecker();
      });
    }

    ['qYear', 'qFood', 'qCar', 'qSub'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', updateChecker);
    });

    updateChecker();
  }

  /* 7. LIVE SEARCHABLE WASTE CLASSIFIER */
  var WASTE_ITEMS = [
    { code: '3532604', name: 'Ртутные и люминесцентные лампы отработанные', hazard: '1-й класс', tag: 'is-high', group: '1-й класс', place: 'Учебные классы, кабинеты, коридоры, цеха' },
    { code: '3532201', name: 'Свинцовые аккумуляторы отработанные неповреждённые', hazard: '1-й класс', tag: 'is-high', group: '1-й класс', place: 'Гараж, собственный автотранспорт, ИБП' },
    { code: '5410201', name: 'Отработанные моторные масла', hazard: '3-й класс', tag: '', group: '3-й класс', place: 'Посты ТО, СТО, автохозяйство' },
    { code: '5492800', name: 'Масляные и топливные фильтры отработанные', hazard: '3-й класс', tag: '', group: '3-й класс', place: 'СТО, обслуживание служебного транспорта' },
    { code: '3532507', name: 'Отработанные элементы питания (батарейки)', hazard: '3-й класс', tag: '', group: '3-й класс', place: 'Кабинеты, офисные и хозяйственные помещения' },
    { code: '3990100', name: 'Списанная оргтехника и электронное оборудование', hazard: '3-й класс', tag: '', group: '3-й класс', place: 'Администрация, классы информатики, бухгалтерия' },
    { code: '5750201', name: 'Изношенные шины с металлическим кордом', hazard: '3-й класс', tag: '', group: '3-й класс', place: 'Гараж, автопарк, СТО' },
    { code: '9120300', name: 'Пищевые отходы кухонь и столовых', hazard: '4-й класс', tag: '', group: '4-й класс', place: 'Пищеблок, столовая, буфет, кафе' },
    { code: '9120800', name: 'Уличный и дворовый смёт', hazard: '4-й класс', tag: '', group: '4-й класс', place: 'Уборка прилегающей территории' },
    { code: '9120400', name: 'Отходы производства, подобные отходам жизнедеятельности', hazard: '4-й класс', tag: '', group: '4-й класс', place: 'Все помещения организации, контейнерная площадка' },
    { code: '5712110', name: 'Отходы ПЭТ-бутылок и полимерной упаковки', hazard: 'Неопасные', tag: 'is-safe', group: 'Неопасные', place: 'Буфет, склад, административные помещения' },
    { code: '1870601', name: 'Макулатура (отходы бумаги и картона)', hazard: 'Неопасные', tag: 'is-safe', group: 'Неопасные', place: 'Администрация, архив, библиотека, склад' },
    { code: '3510100', name: 'Лом и отходы чёрных металлов', hazard: 'Неопасные', tag: 'is-safe', group: 'Неопасные', place: 'Мастерские, ремонтные участки, хоздвор' },
    { code: '1720100', name: 'Растительные отходы (обрезка веток, листва)', hazard: 'Неопасные', tag: 'is-safe', group: 'Неопасные', place: 'Уход за зелёной зоной и территорией' }
  ];

  function initWasteClassifier() {
    var filtersWrap = $('wasteFilters');
    var searchEl = $('wasteSearch');
    var tbody = $('wasteTbody');
    if (!filtersWrap || !tbody) return;

    var groups = ['Все', '1-й класс', '3-й класс', '4-й класс', 'Неопасные'];
    var activeGroup = 'Все';

    groups.forEach(function (g, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn' + (idx === 0 ? ' is-active' : '');
      btn.textContent = g;
      btn.addEventListener('click', function () {
        activeGroup = g;
        filtersWrap.querySelectorAll('.chip-btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderWaste();
      });
      filtersWrap.appendChild(btn);
    });

    function renderWaste() {
      var q = searchEl ? searchEl.value.trim().toLowerCase() : '';
      var list = WASTE_ITEMS.filter(function (item) {
        var matchG = activeGroup === 'Все' || item.group === activeGroup;
        var matchQ = !q ||
          item.code.indexOf(q) !== -1 ||
          item.name.toLowerCase().indexOf(q) !== -1 ||
          item.place.toLowerCase().indexOf(q) !== -1;
        return matchG && matchQ;
      });

      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty">По запросу ничего не найдено – уточните перечень у инженера-эколога.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(function (item) {
        return '<tr>' +
          '<td class="waste-code-cell">' +
            '<button type="button" class="waste-code-btn" data-copy-code="' + item.code + '" title="Скопировать код ' + item.code + '">' +
              '<span>' + item.code + '</span>' +
              '<svg class="icon" aria-hidden="true"><use href="#ic-copy"/></svg>' +
            '</button>' +
          '</td>' +
          '<td>' + escapeHtml(item.name) + '</td>' +
          '<td><span class="hazard-tag ' + item.tag + '">' + escapeHtml(item.hazard) + '</span></td>' +
          '<td>' + escapeHtml(item.place) + '</td>' +
        '</tr>';
      }).join('');

      tbody.querySelectorAll('[data-copy-code]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var code = btn.getAttribute('data-copy-code');
          copyText(code, 'Код отхода ' + code + ' скопирован');
        });
      });
    }

    if (searchEl) searchEl.addEventListener('input', renderWaste);
    renderWaste();
  }

  /* 8. PRICING MODE SWITCHER (Single/Packages vs 3 Retainer Tiers) */
  function initPricingTabs() {
    var tabOnce = $('tabPriceOnce');
    var tabSub = $('tabPriceSub');
    var panelOnce = $('panelPriceOnce');
    var panelSub = $('panelPriceSub');
    if (!tabOnce || !tabSub || !panelOnce || !panelSub) return;

    function selectMode(mode) {
      var isOnce = mode === 'once';
      tabOnce.classList.toggle('is-active', isOnce);
      tabOnce.setAttribute('aria-selected', isOnce ? 'true' : 'false');
      tabSub.classList.toggle('is-active', !isOnce);
      tabSub.setAttribute('aria-selected', !isOnce ? 'true' : 'false');
      panelOnce.hidden = !isOnce;
      panelSub.hidden = isOnce;
    }

    tabOnce.addEventListener('click', function () { selectMode('once'); });
    tabSub.addEventListener('click', function () { selectMode('sub'); });
  }

  /* 9. PREFILL TRIGGERS & ONE-CLICK REQUISITES COPY */
  function initPrefillAndCopy() {
    document.querySelectorAll('[data-prefill-msg]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        prefillForm(el.getAttribute('data-prefill-count') || '1 объект', el.getAttribute('data-prefill-msg'));
      });
    });

    document.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyText(btn.getAttribute('data-copy'), btn.getAttribute('data-copy-label') || 'Скопировано');
      });
    });

    var copyAll = $('copyAllRequisites');
    if (copyAll) {
      copyAll.addEventListener('click', function () {
        var text = [
          'Исполнитель: ООО «Нестудио» (направление «ЭкоНорма»)',
          'УНП: 194055643',
          'Регистрация: Минский горисполком',
          'Юридический адрес: 220117, г. Минск, пр-т Газеты Звязда, 16, пом. 26',
          'Банк: ЗАО «БСБ Банк», BIC UNBSBY2X',
          'Р/с BYN: BY97 UNBS 3012 2628 3000 0000 0933',
          'Директор: Нестерук Сергей Фёдорович',
          'Тел.: +375 44 713-88-69 · E-mail: info@econorma.by'
        ].join('\n');
        copyText(text, 'Реквизиты ООО «Нестудио» скопированы');
      });
    }
  }

  /* 10. MOBILE MENU */
  function initMobileNav() {
    var toggle = $('menuToggle');
    var drawer = $('mobileDrawer');
    if (!toggle || !drawer) return;

    function setOpen(open) {
      drawer.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setOpen(!drawer.classList.contains('is-open'));
    });

    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        setOpen(false);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* 11. NON-DESTRUCTIVE LEAD FORM WITH FIELD VALIDATION & MULTI-CHANNEL DELIVERY */
  function initLeadForm() {
    var form = $('leadForm');
    var errBox = $('formError');
    var errOrg = $('errOrg');
    var errContact = $('errContact');
    var successBox = $('formSuccess');
    if (!form || !successBox) return;

    function setFieldErr(inputEl, errEl, msg) {
      if (inputEl) inputEl.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (errEl) errEl.textContent = msg || '';
    }

    function showBannerErr(msg) {
      if (!errBox) return;
      errBox.textContent = msg || '';
      errBox.classList.toggle('is-visible', Boolean(msg));
    }

    form.org.addEventListener('input', function () {
      if (form.org.value.trim()) setFieldErr(form.org, errOrg, '');
    });
    form.contact.addEventListener('input', function () {
      if (form.contact.value.trim()) setFieldErr(form.contact, errContact, '');
    });
    form.consent.addEventListener('change', function () {
      if (form.consent.checked) showBannerErr('');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setFieldErr(form.org, errOrg, '');
      setFieldErr(form.contact, errContact, '');
      showBannerErr('');

      var org = form.org.value.trim();
      var contact = form.contact.value.trim();
      var objects = form.objects.value;
      var comment = form.comment.value.trim();
      var consent = form.consent.checked;
      var channelEl = form.querySelector('input[name="channel"]:checked');
      var channel = channelEl ? channelEl.value : 'Телефон';

      if (!org) {
        setFieldErr(form.org, errOrg, 'Укажите наименование организации.');
        form.org.focus();
        return;
      }
      if (!contact || contact.length < 5) {
        setFieldErr(form.contact, errContact, 'Укажите корректный телефон, Telegram или e-mail.');
        form.contact.focus();
        return;
      }
      if (!consent) {
        showBannerErr('Для отправки запроса необходимо согласие на обработку персональных данных.');
        form.consent.focus();
        return;
      }

      var summaryLines = [
        'Организация: ' + org,
        'Контакт: ' + contact,
        'Предпочтительный канал ответа: ' + channel,
        'Количество объектов: ' + objects
      ];
      if (comment) summaryLines.push('Комментарий: ' + comment);
      var bodyText = summaryLines.join('\n');

      if (LEAD_ENDPOINT) {
        var submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Отправка…';
        }
        fetch(LEAD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org: org, contact: contact, channel: channel, objects: objects, comment: comment, text: bodyText })
        })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            renderSentState(bodyText, true);
          })
          .catch(function () {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Отправить запрос на расчёт';
            }
            showBannerErr('Не удалось отправить заявку автоматически. Позвоните +375 44 713-88-69 или отправьте текст на info@econorma.by.');
          });
      } else {
        renderSentState(bodyText, false);
      }
    });

    function renderSentState(bodyText, sentViaApi) {
      var mailtoUrl =
        'mailto:info@econorma.by?subject=' +
        encodeURIComponent('Запрос КП – ЭкоНорма') +
        '&body=' +
        encodeURIComponent(bodyText);

      var tgUrl = TELEGRAM_HANDLE
        ? ('https://t.me/' + encodeURIComponent(TELEGRAM_HANDLE) + '?text=' + encodeURIComponent(bodyText))
        : ('https://t.me/share/url?url=' + encodeURIComponent('https://econorma.by/') + '&text=' + encodeURIComponent(bodyText));

      successBox.innerHTML =
        '<h3>' + (sentViaApi ? 'Запрос получен' : 'Заявка сформирована') + '</h3>' +
        '<p>' +
          (sentViaApi
            ? 'Спасибо. Подготовим расчёт и ответим в течение рабочего дня.'
            : 'Выберите удобный способ передачи заявки – подготовим расчёт и ответим в течение рабочего дня.') +
        '</p>' +
        '<div class="form-summary-box">' + escapeHtml(bodyText) + '</div>' +
        '<div class="form-success-actions">' +
          (!sentViaApi ? '<a class="btn btn-primary" href="' + mailtoUrl + '">Открыть в почте</a>' : '') +
          (!sentViaApi ? '<a class="btn btn-secondary" href="' + tgUrl + '" target="_blank" rel="noopener">Передать в Telegram</a>' : '') +
          '<button type="button" class="btn btn-secondary" id="copyRequestBtn">Скопировать текст</button>' +
          '<button type="button" class="btn btn-ghost" id="downloadRequestBtn"><svg class="icon" aria-hidden="true"><use href="#ic-download"/></svg>Скачать .txt</button>' +
          '<button type="button" class="btn btn-ghost" id="editRequestBtn">Изменить данные</button>' +
        '</div>';

      form.hidden = true;
      successBox.hidden = false;

      var copyBtn = $('copyRequestBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          copyText(bodyText, 'Текст заявки скопирован');
        });
      }
      var dlBtn = $('downloadRequestBtn');
      if (dlBtn) {
        dlBtn.addEventListener('click', function () {
          downloadTextFile('zayavka_econorma.txt', bodyText);
        });
      }
      var editBtn = $('editRequestBtn');
      if (editBtn) {
        editBtn.addEventListener('click', function () {
          successBox.hidden = true;
          form.hidden = false;
          var submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить запрос на расчёт';
          }
          form.org.focus();
        });
      }
    }
  }

  /* Init everything */
  function init() {
    initNavigationEnhancements();
    initHeroDossier();
    initDistrictBoard();
    initDocGallery();
    initModal();
    initZavhozChecklist();
    initChecker();
    initWasteClassifier();
    initPricingTabs();
    initPrefillAndCopy();
    initMobileNav();
    initLeadForm();

    window.addEventListener('resize', function () {
      fitHeroScale();
      fitThumbScales();
      fitModalScale();
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        fitHeroScale();
        fitThumbScales();
        fitModalScale();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
