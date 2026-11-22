/* ЭкоНорма — interactive UI controller
   Handles: hero dossier switcher, samples filter & A4 reader modal, print,
   1-minute regulatory self-check, one-click requisite copying, mobile nav, and lead form. */
(function () {
  var DOCS = window.ECONORMA_DOCS || [];
  var EXTRA = window.ECONORMA_EXTRA_DOCS || {};
  var LEAD_ENDPOINT = ''; // Подключите URL webhook (Telegram-бот / CRM) при публикации

  function $(id) {
    return document.getElementById(id);
  }

  function createPaper(html) {
    var el = document.createElement('div');
    el.className = 'doc-paper';
    el.innerHTML = html;
    return el;
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
    }, 2400);
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

  /* Prefill lead form helper */
  function prefillForm(countText, msgText) {
    var form = $('leadForm');
    if (!form) return;
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
    var contact = $('contact');
    if (contact) {
      contact.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    if (form.org) {
      setTimeout(function () {
        form.org.focus({ preventScroll: true });
      }, 300);
    }
  }

  /* 1. HERO INTERACTIVE DOSSIER */
  var heroDocIds = ['school', 'clinic', 'center'];
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

    var tabs = document.querySelectorAll('.dossier-tab');
    tabs.forEach(function (tab) {
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
      btn.textContent = found.doc.tabLabel || found.doc.sphere;
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
  }

  /* 2. DOCUMENT SAMPLES GALLERY */
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
        '<span class="doc-card-meta">' + d.sphere + ' · ' + d.type + '</span>' +
        '<span class="doc-card-title">' + d.title + '</span>' +
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

  /* 3. DOCUMENT READER MODAL */
  var currentModalIndex = -1;
  var currentModalDoc = null;
  var lastFocusedEl = null;

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

    $('modalType').textContent = doc.sphere + ' · ' + doc.type;
    $('modalTitle').textContent = doc.title;

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

  function fitModalScale() {
    var body = $('modalBody');
    if (!body) return;
    var wrap = body.querySelector('.modal-scale');
    if (!wrap) return;
    var paper = wrap.firstChild;
    if (!paper) return;
    var avail = Math.max(280, body.clientWidth - 24);
    var s = Math.min(1, avail / 794);
    paper.style.transform = 'scale(' + s + ')';
    wrap.style.width = Math.round(794 * s) + 'px';
    wrap.style.height = Math.round(paper.offsetHeight * s) + 'px';
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
    $('modalClose').addEventListener('click', closeModal);
    $('modalPrev').addEventListener('click', function () {
      if (currentModalIndex >= 0) openDocIndex(currentModalIndex - 1);
    });
    $('modalNext').addEventListener('click', function () {
      if (currentModalIndex >= 0) openDocIndex(currentModalIndex + 1);
    });
    $('modalPrint').addEventListener('click', function () {
      window.print();
    });
    $('modalCta').addEventListener('click', function () {
      var doc = currentModalDoc;
      closeModal();
      if (doc) {
        prefillForm(doc.ctaCount || '1 объект', doc.ctaMsg || ('Запрос по образцу: ' + doc.title));
      }
    });

    modal.addEventListener('click', function (e) {
      if (e.target === $('modalBody')) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'ArrowRight' && currentModalIndex >= 0) {
        openDocIndex(currentModalIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentModalIndex >= 0) {
        openDocIndex(currentModalIndex - 1);
      }
    });

    /* Any button/link with data-open-doc */
    document.querySelectorAll('[data-open-doc]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openDocById(el.getAttribute('data-open-doc'));
      });
    });
  }

  /* 4. SELF-CHECK CALCULATOR */
  var lastCheckResult = { countText: '1 объект', summary: '' };

  function updateChecker() {
    var yearEl = $('qYear');
    var countEl = $('qCount');
    var foodEl = $('qFood');
    var carEl = $('qCar');
    var out = $('checkerOutput');
    if (!yearEl || !countEl || !out) return;

    var y = yearEl.value;
    var n = countEl.value;
    var countLabel = countEl.options[countEl.selectedIndex].text;
    var hasFood = foodEl && foodEl.checked;
    var hasCar = carEl && carEl.checked;

    var statusCode = 'Вывод проверки';
    var title = '';
    var summary = '';
    var priceLabel = 'Ориентир стоимости';
    var priceVal = '';

    if (y === 'none') {
      statusCode = 'Требуется разработка';
      title = 'Нужна разработка новой инструкции';
      summary = 'Без утверждённой инструкции организация не выполняет требования Закона № 271-З. Подготовим пакет с обследованием, инвентаризацией и расчётом нормативов.';
    } else if (y === 'old') {
      statusCode = 'Срок истёк или истекает';
      title = 'Пора продлевать инструкцию';
      summary = 'Пятилетний срок действия инструкции закончился или подходит к концу. Потребуется актуализация инвентаризации и утверждение новой инструкции.';
    } else if (y === 'mid') {
      statusCode = 'План на 2027 год';
      title = 'Продление предстоит в 2027 году';
      summary = 'Инструкции 2022 года истекают в 2027 году. Удобно заранее включить разработку в годовой план закупок и согласовать график.';
    } else {
      statusCode = 'Инструкция действует';
      title = 'Документ в пределах пятилетнего срока';
      summary = 'Если состав отходов, оборудование, транспорт или площади не менялись — достаточно вести книги учёта ПОД-9 и ПОД-10. При изменениях нужна корректировка.';
    }

    var notes = [];
    if (hasFood) {
      notes.push('Пищеблок или столовая: пропишем раздельный сбор пищевых отходов и порядок их передачи.');
    }
    if (hasCar) {
      notes.push('Собственный автотранспорт: добавим раздел по отработанным маслам, фильтрам, шинам и аккумуляторам.');
    }
    if (n !== '1') {
      notes.push('Пакетный формат (' + countLabel + '): единый договор, реестр статусов по каждому объекту и поэтапная сдача.');
    }

    if (y === 'new') {
      priceLabel = 'Проверка актуальности';
      priceVal = 'Бесплатная консультация эколога';
    } else if (n === '1') {
      priceVal = 'от 450 BYN за объект';
    } else if (n === '5') {
      priceVal = 'по расчёту (скидка при пакете 2–10 объектов)';
    } else if (n === '20') {
      priceVal = 'по расчёту (пакет 11–30 объектов)';
    } else {
      priceVal = 'по расчёту (районный пакет 30+ объектов)';
    }

    var summaryParts = [title];
    if (hasFood) summaryParts.push('есть пищеблок');
    if (hasCar) summaryParts.push('есть автотранспорт');
    lastCheckResult = {
      countText: countLabel,
      summary: summaryParts.join('; ')
    };

    var notesHtml = notes.length
      ? '<ul class="checker-notes">' + notes.map(function (t) { return '<li><span>' + t + '</span></li>'; }).join('') + '</ul>'
      : '';

    out.innerHTML =
      '<div>' +
        '<div class="checker-status">' + statusCode + '</div>' +
        '<h3 class="checker-title">' + title + '</h3>' +
        '<p class="checker-summary">' + summary + '</p>' +
        notesHtml +
      '</div>' +
      '<div class="checker-price-box">' +
        '<div class="checker-price-label">' + priceLabel + '</div>' +
        '<div class="checker-price-val">' + priceVal + '</div>' +
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
        openDocById(n === '50' || n === '20' ? 'center' : (hasCar ? 'sto' : 'school'));
      });
    }
  }

  function initChecker() {
    ['qYear', 'qCount', 'qFood', 'qCar'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', updateChecker);
    });
    updateChecker();
  }

  /* 5. PREFILL TRIGGERS (Services & Pricing) */
  function initPrefillTriggers() {
    document.querySelectorAll('[data-prefill-msg]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        prefillForm(el.getAttribute('data-prefill-count') || '1 объект', el.getAttribute('data-prefill-msg'));
      });
    });
  }

  /* 6. ONE-CLICK COPY FOR TENDER REQUISITES */
  function initCopyButtons() {
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

  /* 7. MOBILE MENU */
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

  /* 8. LEAD FORM WITH INLINE VALIDATION & CLEAN FALLBACK */
  function initLeadForm() {
    var form = $('leadForm');
    var errBox = $('formError');
    if (!form) return;

    function showError(msg, focusEl) {
      if (errBox) {
        errBox.textContent = msg;
        errBox.classList.add('is-visible');
      }
      if (focusEl) focusEl.focus();
    }

    function clearError() {
      if (errBox) {
        errBox.textContent = '';
        errBox.classList.remove('is-visible');
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();

      var org = form.org.value.trim();
      var contact = form.contact.value.trim();
      var objects = form.objects.value;
      var comment = form.comment.value.trim();
      var consent = form.consent.checked;

      if (!org) {
        showError('Укажите наименование организации, чтобы мы смогли адресно подготовить коммерческое предложение.', form.org);
        return;
      }
      if (!contact) {
        showError('Укажите телефон или электронную почту для ответа.', form.contact);
        return;
      }
      if (!consent) {
        showError('Для отправки запроса необходимо согласие на обработку персональных данных.', form.consent);
        return;
      }

      var summaryLines = [
        'Организация: ' + org,
        'Контакт: ' + contact,
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
          body: JSON.stringify({ org: org, contact: contact, objects: objects, comment: comment, text: bodyText })
        })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            renderSentState(form, bodyText, true);
          })
          .catch(function () {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Отправить запрос';
            }
            showError('Не удалось отправить заявку автоматически. Позвоните по номеру +375 44 713-88-69 или напишите на info@econorma.by.');
          });
      } else {
        renderSentState(form, bodyText, false);
      }
    });
  }

  function renderSentState(form, bodyText, sentViaApi) {
    var mailtoUrl =
      'mailto:info@econorma.by?subject=' +
      encodeURIComponent('Запрос КП — ЭкоНорма') +
      '&body=' +
      encodeURIComponent(bodyText);

    var safeText = bodyText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    var wrap = document.createElement('div');
    wrap.className = 'form-success';
    wrap.innerHTML =
      '<h3>' + (sentViaApi ? 'Запрос получен' : 'Заявка сформирована') + '</h3>' +
      '<p>' +
        (sentViaApi
          ? 'Спасибо. Подготовим расчёт и ответим в течение рабочего дня.'
          : 'Отправьте готовый текст на info@econorma.by через почтовый клиент или скопируйте его в один клик — ответим в течение рабочего дня.') +
      '</p>' +
      '<div class="form-summary-box">' + safeText + '</div>' +
      '<div class="form-success-actions">' +
        (!sentViaApi ? '<a class="btn btn-primary" href="' + mailtoUrl + '">Открыть в почте</a>' : '') +
        '<button type="button" class="btn btn-secondary" id="copyRequestBtn">Скопировать текст заявки</button>' +
      '</div>';

    form.innerHTML = '';
    form.appendChild(wrap);

    var copyBtn = $('copyRequestBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyText(bodyText, 'Текст заявки скопирован');
      });
    }
  }

  /* Init everything */
  function init() {
    initHeroDossier();
    initDocGallery();
    initModal();
    initChecker();
    initPrefillTriggers();
    initCopyButtons();
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
