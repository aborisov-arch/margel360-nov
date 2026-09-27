const SUPABASE_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
    const FN_GET = `${SUPABASE_URL}/functions/v1/get-feedback-by-token`;
    const FN_SUB = `${SUPABASE_URL}/functions/v1/submit-feedback`;
    // Survey reward: % off the hall rent only. Mirrors FEEDBACK_DISCOUNT_PERCENT
    // in supabase/functions/_shared/feedback-reward.ts (+ feedback.html defaults).
    const REWARD_PERCENT = 5;
    // Survey form v2: five questions rated 1-5 stars. The keys mirror
    // supabase/functions/_shared/feedback-form.ts (sent as `${key}_rating`).
    const FORM_VERSION = 2;
    const RATINGS = ['organization', 'website', 'overall', 'cleanliness', 'team'];
    const STARS = 5;

    const $ = id => document.getElementById(id);
    const storedLang = () => { try { return localStorage.getItem('margel_lang'); } catch { return null; } };
    const state = {
      token: null,
      preview: false,
      pct: REWARD_PERCENT, // replaced by the issued code's own percent on submit
      organization: 0, website: 0, overall: 0, cleanliness: 0, team: 0,
      source: null,
      lang: storedLang() === 'en' ? 'en' : 'bg',
    };

    const I18N = {
      bg: {
        loading_label: 'Зареждане',
        loading_title: 'Подготвяме формата…',
        nf_label: 'Упс',
        nf_title: 'Линкът не е намерен.',
        nf_body: 'Моля пишете ни директно - ще се радваме да чуем впечатленията ви.',
        thanks_label: '- получено -',
        thanks_title: 'Благодарим!',
        thanks_body: 'Вашите впечатления вече са с нас. Като благодарност ви подаряваме <strong>{pct}% отстъпка</strong> от наема на залата при следващото ви събитие.',
        thanks_code_label: 'Вашият промо код',
        thanks_code_hint: 'Изпратихме го и на имейла ви. Валиден за една година, еднократна употреба.',
        thanks_code_emailfail: 'Запазете кода - изпращането на имейла не успя. Свържете се с нас, ако имате нужда от копие.',
        form_label: 'Впечатления · след събитието',
        form_title: 'Вашето мнение е <em>важно</em> за нас',
        form_lead: 'Благодарим Ви, че избрахте нашата зала за Вашето събитие. Анкетата отнема по-малко от 1 минута.',
        reward: '<strong>Подарък от нас:</strong> попълнете анкетата и получавате <strong>{pct}% отстъпка</strong> от наема на залата при следваща резервация при нас.',
        q_organization: '1.&nbsp;&nbsp;Как оценявате <em>организацията</em> преди събитието?',
        h_organization: 'Офертата, комуникацията, съдействието и подготовката от наша страна.',
        q_website:      '2.&nbsp;&nbsp;Как оценявате нашия <em>уебсайт</em>?',
        h_website:      'Информация, визия и леснота при намиране на необходимото.',
        q_overall:      '3.&nbsp;&nbsp;Как оценявате <em>цялостното си преживяване</em> и атмосферата в залата?',
        q_cleanliness:  '4.&nbsp;&nbsp;Как оценявате <em>чистотата</em> и поддръжката на залата?',
        q_team:         '5.&nbsp;&nbsp;Как оценявате <em>обслужването</em> и отношението на нашия екип по време на събитието?',
        q_source:       '6.&nbsp;&nbsp;<em>Откъде</em> научихте за нас?',
        q_improve:      '7.&nbsp;&nbsp;Какво бихте ни препоръчали да <em>подобрим</em>?',
        h_improve:      'Ще се радваме да споделите Вашите препоръки, идеи или забележки.',
        star_label: '{n} от 5',
        src_friends: 'Приятели',
        src_social: 'Социални мрежи',
        src_other: 'Друго',
        src_other_label: 'Откъде по-точно?',
        submit: 'Изпрати анкетата',
        submitting: 'Изпращане…',
        err_missing: 'Моля, отговорете на всички въпроси: ',
        err_server: 'Нещо се обърка. Моля опитайте отново или пишете на 360@margel.info.',
        missing_organization: 'организация', missing_website: 'уебсайт', missing_overall: 'преживяване',
        missing_cleanliness: 'чистота', missing_team: 'обслужване', missing_source: 'откъде научихте за нас',
        preview_banner: 'Преглед: така клиентът вижда анкетата. Отговорите тук не се записват.',
      },
      en: {
        loading_label: 'Loading',
        loading_title: 'Preparing the form…',
        nf_label: 'Oops',
        nf_title: 'Link not found.',
        nf_body: 'Please write to us directly - we would love to hear your impressions.',
        thanks_label: '- received -',
        thanks_title: 'Thank you!',
        thanks_body: 'Your feedback is with us. As a thank-you, here is a <strong>{pct}% discount</strong> off the venue hire for your next event with us.',
        thanks_code_label: 'Your promo code',
        thanks_code_hint: 'We also emailed it to you. Valid for one year, single use.',
        thanks_code_emailfail: 'Please save this code - we could not deliver the email. Contact us if you need a copy.',
        form_label: 'Feedback · after the event',
        form_title: 'Your opinion <em>matters</em> to us',
        form_lead: 'Thank you for choosing our venue for your event. The survey takes less than 1 minute.',
        reward: '<strong>A gift from us:</strong> complete the survey and receive a <strong>{pct}% discount</strong> off the venue hire on your next booking.',
        q_organization: '1.&nbsp;&nbsp;How would you rate the <em>organisation</em> before the event?',
        h_organization: 'The offer, communication, assistance and preparation on our side.',
        q_website:      '2.&nbsp;&nbsp;How would you rate our <em>website</em>?',
        h_website:      'Information, design and how easy it is to find what you need.',
        q_overall:      '3.&nbsp;&nbsp;How would you rate your <em>overall experience</em> and the atmosphere in the venue?',
        q_cleanliness:  '4.&nbsp;&nbsp;How would you rate the <em>cleanliness</em> and upkeep of the venue?',
        q_team:         '5.&nbsp;&nbsp;How would you rate the <em>service</em> and attitude of our team during the event?',
        q_source:       '6.&nbsp;&nbsp;How did you <em>hear</em> about us?',
        q_improve:      '7.&nbsp;&nbsp;What would you recommend we <em>improve</em>?',
        h_improve:      'We would be glad to hear your recommendations, ideas or remarks.',
        star_label: '{n} of 5',
        src_friends: 'Friends',
        src_social: 'Social media',
        src_other: 'Other',
        src_other_label: 'Where exactly?',
        submit: 'Submit the survey',
        submitting: 'Sending…',
        err_missing: 'Please answer all questions: ',
        err_server: 'Something went wrong. Please try again or write to 360@margel.info.',
        missing_organization: 'organisation', missing_website: 'website', missing_overall: 'experience',
        missing_cleanliness: 'cleanliness', missing_team: 'service', missing_source: 'how you heard about us',
        preview_banner: 'Preview: this is the survey as customers see it. Answers here are not saved.',
      },
    };

    function t(key) { return I18N[state.lang][key] ?? key; }

    const fillPct = s => String(s).replaceAll('{pct}', state.pct);

    function applyI18n() {
      document.documentElement.lang = state.lang;
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        if (I18N[state.lang][k] !== undefined) el.textContent = fillPct(I18N[state.lang][k]);
      });
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const k = el.getAttribute('data-i18n-html');
        if (I18N[state.lang][k] !== undefined) el.innerHTML = fillPct(I18N[state.lang][k]);
      });
      document.querySelectorAll('.star-btn').forEach(b =>
        b.setAttribute('aria-label', t('star_label').replace('{n}', b.dataset.value)));
      const bgBtn = $('lang-bg'), enBtn = $('lang-en');
      if (bgBtn && enBtn) {
        bgBtn.style.opacity = state.lang === 'bg' ? '1' : '0.4';
        enBtn.style.opacity = state.lang === 'en' ? '1' : '0.4';
      }
    }

    function setLang(lang) {
      state.lang = lang;
      try { localStorage.setItem('margel_lang', lang); } catch {}
      applyI18n();
    }

    function show(id) {
      document.querySelectorAll('.spread').forEach(el => { el.hidden = true; });
      const el = $(id); if (el) el.hidden = false;
    }

    // Light up the stars 1..val; frame the chosen one.
    function paintStars(wrap, val, chosen) {
      wrap.querySelectorAll('.star-btn').forEach(b => {
        const v = parseInt(b.dataset.value, 10);
        b.classList.toggle('is-lit', v <= val);
        b.classList.toggle('is-on', v === chosen);
        b.setAttribute('aria-checked', v === chosen ? 'true' : 'false');
        b.tabIndex = v === (chosen || 1) ? 0 : -1;
      });
    }

    function buildStars(section) {
      const key = section.dataset.q;
      const wrap = section.querySelector('.stars');
      wrap.innerHTML = '';
      for (let i = 1; i <= STARS; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'star-btn';
        b.dataset.value = i;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', t('star_label').replace('{n}', i));
        b.innerHTML = `<span class="star-btn__icon" aria-hidden="true">★</span><span>${i}</span>`;
        wrap.appendChild(b);
      }
      const choose = val => { state[key] = val; paintStars(wrap, val, val); };
      wrap.addEventListener('click', evt => {
        const b = evt.target.closest('button.star-btn');
        if (b) choose(parseInt(b.dataset.value, 10));
      });
      // Hover previews how many stars a click would give.
      wrap.addEventListener('mouseover', evt => {
        const b = evt.target.closest('button.star-btn');
        if (b) paintStars(wrap, parseInt(b.dataset.value, 10), state[key]);
      });
      wrap.addEventListener('mouseleave', () => paintStars(wrap, state[key], state[key]));
      // Radio-group keys: arrows move and choose.
      wrap.addEventListener('keydown', evt => {
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[evt.key];
        if (!step) return;
        evt.preventDefault();
        const val = Math.min(STARS, Math.max(1, (state[key] || 0) + step));
        choose(val);
        wrap.querySelector(`.star-btn[data-value="${val}"]`).focus();
      });
      paintStars(wrap, state[key], state[key]);
    }

    function buildSource() {
      const wrap = $('source-choices');
      const otherWrap = $('source-other-wrap');
      wrap.addEventListener('click', evt => {
        const b = evt.target.closest('button.choice');
        if (!b) return;
        state.source = b.dataset.source;
        wrap.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
        otherWrap.hidden = state.source !== 'other';
      });
    }

    function paintSource() {
      if (!state.source) return;
      $('source-choices').querySelectorAll('button').forEach(b =>
        b.classList.toggle('is-on', b.dataset.source === state.source));
      $('source-other-wrap').hidden = state.source !== 'other';
    }

    function renderForm() {
      document.querySelectorAll('.question[data-rating]').forEach(buildStars);
      buildSource();
      paintSource();
      show('state-form');
    }

    async function main() {
      const params = new URLSearchParams(location.search);
      // ?lang=en|bg (e.g. the English preview link) sets and remembers the
      // language; a real survey link then follows the booking's language.
      const qLang = params.get('lang');
      if (qLang === 'bg' || qLang === 'en') setLang(qLang);
      applyI18n();
      $('lang-bg').addEventListener('click', () => setLang('bg'));
      $('lang-en').addEventListener('click', () => setLang('en'));

      // ?preview=1 — the admin panel's „Преглед на формата“ link: the empty
      // survey as customers see it; nothing is loaded or saved.
      if (params.get('preview') === '1') {
        state.preview = true;
        $('preview-banner').hidden = false;
        renderForm();
        $('feedback-form').addEventListener('submit', onSubmit);
        return;
      }

      const token = params.get('token');
      if (!token) return show('state-not-found');
      state.token = token;

      try {
        const r = await fetch(FN_GET, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) return show('state-not-found');

        // Render the survey in the customer's booking language (from the
        // enquiry), not the viewer's browser margel_lang. Falls back to the
        // current language if the enquiry has none (older rows default 'bg').
        const enqLang = body.enquiry && body.enquiry.lang;
        if (enqLang === 'bg' || enqLang === 'en') { state.lang = enqLang; applyI18n(); }

        // Pre-fill a saved answer to this form. An answer to the older 1-4
        // form doesn't map onto these questions: only its source carries over.
        const ex = body.existing;
        if (ex) {
          if (ex.form_version === FORM_VERSION) {
            RATINGS.forEach(k => { state[k] = ex[`${k}_rating`] || 0; });
            $('c-improve').value = ex.improvement_comment || '';
          }
          state.source = ex.source || null;
          $('c-source-other').value = ex.source_other || '';
        }

        renderForm();
      } catch {
        show('state-not-found');
      }

      $('feedback-form').addEventListener('submit', onSubmit);
    }

    async function onSubmit(evt) {
      evt.preventDefault();
      const err = $('fb-error');
      err.classList.add('hidden');

      const missing = RATINGS.filter(k => !state[k]).map(k => t(`missing_${k}`));
      if (!state.source) missing.push(t('missing_source'));
      if (missing.length) {
        err.textContent = t('err_missing') + missing.join(', ') + '.';
        err.classList.remove('hidden');
        err.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (state.preview) {
        $('thank-code').textContent = 'MG-XXXX-XXXX';
        $('thank-code-box').hidden = false;
        show('state-thanks');
        applyI18n();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const btn = $('btn-submit');
      btn.disabled = true; btn.textContent = t('submitting');

      const payload = {
        token: state.token,
        form_version: FORM_VERSION,
        improvement_comment: $('c-improve').value.trim() || null,
        source: state.source,
        source_other: state.source === 'other' ? ($('c-source-other').value.trim() || null) : null,
      };
      RATINGS.forEach(k => { payload[`${k}_rating`] = state[k]; });

      try {
        const r = await fetch(FN_SUB, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error || 'server_error');
        if (Number.isInteger(body.discount_percent)) state.pct = body.discount_percent;
        if (body.discount_code) {
          $('thank-code').textContent = body.discount_code;
          $('thank-code-box').hidden = false;
          // If Resend rejected the discount email, hide the "we emailed it"
          // hint and surface a "save this code" banner instead. Default is
          // delivered = true (older deploys won't return the flag).
          const delivered = body.email_delivered !== false;
          $('thank-code-hint').style.display = delivered ? '' : 'none';
          $('thank-code-emailfail').style.display = delivered ? 'none' : '';
        }
        show('state-thanks');
        applyI18n();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        console.error(e);
        err.textContent = t('err_server');
        err.classList.remove('hidden');
        btn.disabled = false; btn.textContent = t('submit');
      }
    }

    document.addEventListener('DOMContentLoaded', main);
