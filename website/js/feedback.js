const SUPABASE_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
    const FN_GET = `${SUPABASE_URL}/functions/v1/get-feedback-by-token`;
    const FN_SUB = `${SUPABASE_URL}/functions/v1/submit-feedback`;

    const $ = id => document.getElementById(id);
    const state = {
      token: null,
      experience: 0, service: 0, venue: 0, rebook: 0,
      source: null,
      lang: (localStorage.getItem('margel_lang') === 'en') ? 'en' : 'bg',
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
        thanks_body: 'Вашите впечатления вече са с нас. Като благодарност ви подаряваме <strong>3% отстъпка</strong> от наема на залата при следващото ви събитие.',
        thanks_code_label: 'Вашият промо код',
        thanks_code_hint: 'Изпратихме го и на имейла ви. Валиден за една година, еднократна употреба.',
        thanks_code_emailfail: 'Запазете кода - изпращането на имейла не успя. Свържете се с нас, ако имате нужда от копие.',
        form_label: 'Впечатления · след събитието',
        form_title: 'Една <em>минутка</em> от вашето време.',
        form_lead: 'Споделете впечатленията си - помагате ни да правим всеки следващ празник още по-добър.',
        reward: '<strong>Подарък от нас:</strong> попълнете анкетата и получавате <strong>3% отстъпка</strong> от наема на залата при следваща резервация при нас.',
        q_experience: '1.&nbsp;&nbsp;Как бихте оценили <em>цялостното си преживяване</em>?',
        q_service:    '2.&nbsp;&nbsp;Колко доволни останахте от <em>обслужването</em> ни?',
        q_venue:      '3.&nbsp;&nbsp;Как ви се стори <em>атмосферата</em> в залата?',
        q_source:     '4.&nbsp;&nbsp;Как <em>разбрахте</em> за Маргел 360°?',
        q_rebook:     '5.&nbsp;&nbsp;Бихте ли организирали и <em>следващото си събитие</em> при нас?',
        scale_low: '1 - лошо',
        scale_high: '4 - отлично',
        rebook_low: '1 - не',
        rebook_high: '4 - със сигурност',
        comment_optional: 'Коментар (по желание)',
        src_friends: 'Приятели',
        src_social: 'Социални мрежи',
        src_other: 'Друго',
        src_other_label: 'Откъде по-точно?',
        submit: 'Изпрати впечатления',
        submitting: 'Изпращане…',
        err_missing: 'Моля, отговорете на всички въпроси: ',
        err_server: 'Нещо се обърка. Моля опитайте отново или пишете на 360@margel.info.',
        missing_experience: 'преживяване', missing_service: 'обслужване', missing_venue: 'зала', missing_rebook: 'резервация отново', missing_source: 'източник',
      },
      en: {
        loading_label: 'Loading',
        loading_title: 'Preparing the form…',
        nf_label: 'Oops',
        nf_title: 'Link not found.',
        nf_body: 'Please write to us directly - we would love to hear your impressions.',
        thanks_label: '- received -',
        thanks_title: 'Thank you!',
        thanks_body: 'Your feedback is with us. As a thank-you, here is a <strong>3% discount</strong> off the venue hire for your next event with us.',
        thanks_code_label: 'Your promo code',
        thanks_code_hint: 'We also emailed it to you. Valid for one year, single use.',
        thanks_code_emailfail: 'Please save this code - we could not deliver the email. Contact us if you need a copy.',
        form_label: 'Feedback · after the event',
        form_title: 'A <em>minute</em> of your time.',
        form_lead: 'Share your impressions - they help us make every next celebration even better.',
        reward: '<strong>A gift from us:</strong> complete the survey and receive a <strong>3% discount</strong> off the venue hire on your next booking.',
        q_experience: '1.&nbsp;&nbsp;How would you rate your <em>overall experience</em>?',
        q_service:    '2.&nbsp;&nbsp;How satisfied were you with our <em>service</em>?',
        q_venue:      '3.&nbsp;&nbsp;How did you find the <em>atmosphere</em> of the hall?',
        q_source:     '4.&nbsp;&nbsp;How did you <em>hear</em> about Margel 360°?',
        q_rebook:     '5.&nbsp;&nbsp;Would you host your <em>next event</em> with us?',
        scale_low: '1 - poor',
        scale_high: '4 - excellent',
        rebook_low: '1 - no',
        rebook_high: '4 - definitely',
        comment_optional: 'Comment (optional)',
        src_friends: 'Friends',
        src_social: 'Social media',
        src_other: 'Other',
        src_other_label: 'Where exactly?',
        submit: 'Submit feedback',
        submitting: 'Sending…',
        err_missing: 'Please answer all questions: ',
        err_server: 'Something went wrong. Please try again or write to 360@margel.info.',
        missing_experience: 'experience', missing_service: 'service', missing_venue: 'venue', missing_rebook: 'rebook', missing_source: 'source',
      },
    };

    function t(key) { return I18N[state.lang][key] ?? key; }

    function applyI18n() {
      document.documentElement.lang = state.lang;
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        if (I18N[state.lang][k] !== undefined) el.textContent = I18N[state.lang][k];
      });
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const k = el.getAttribute('data-i18n-html');
        if (I18N[state.lang][k] !== undefined) el.innerHTML = I18N[state.lang][k];
      });
      const bgBtn = $('lang-bg'), enBtn = $('lang-en');
      if (bgBtn && enBtn) {
        bgBtn.style.opacity = state.lang === 'bg' ? '1' : '0.4';
        enBtn.style.opacity = state.lang === 'en' ? '1' : '0.4';
      }
    }

    function show(id) {
      document.querySelectorAll('.spread').forEach(el => { el.hidden = true; });
      const el = $(id); if (el) el.hidden = false;
    }

    function buildScale(section) {
      const key = section.dataset.q;
      const wrap = section.querySelector('.scale');
      wrap.innerHTML = '';
      for (let i = 1; i <= 4; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'scale__btn';
        b.dataset.value = i;
        b.textContent = i;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', `${i} от 4`);
        wrap.appendChild(b);
      }
      wrap.addEventListener('click', evt => {
        const b = evt.target.closest('button.scale__btn');
        if (!b) return;
        const val = parseInt(b.dataset.value, 10);
        state[key] = val;
        wrap.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', parseInt(x.dataset.value, 10) === val));
      });
    }

    function paintScale(section) {
      const key = section.dataset.q;
      const val = state[key];
      section.querySelectorAll('.scale__btn').forEach(b =>
        b.classList.toggle('is-on', parseInt(b.dataset.value, 10) === val));
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

    async function main() {
      applyI18n();
      $('lang-bg').addEventListener('click', () => { state.lang = 'bg'; localStorage.setItem('margel_lang','bg'); applyI18n(); });
      $('lang-en').addEventListener('click', () => { state.lang = 'en'; localStorage.setItem('margel_lang','en'); applyI18n(); });

      const params = new URLSearchParams(location.search);
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

        const ex = body.existing;
        if (ex) {
          state.experience = ex.experience_rating || 0;
          state.service    = ex.service_rating    || 0;
          state.venue      = ex.venue_rating      || 0;
          state.rebook     = ex.rebook_rating     || 0;
          state.source     = ex.source || null;
          $('c-experience').value   = ex.experience_comment || '';
          $('c-service').value      = ex.service_comment    || '';
          $('c-venue').value        = ex.venue_comment      || '';
          $('c-rebook').value       = ex.rebook_comment     || '';
          $('c-source-other').value = ex.source_other       || '';
        }

        document.querySelectorAll('.question').forEach(sec => {
          if (sec.dataset.q !== 'source') buildScale(sec);
        });
        buildSource();
        document.querySelectorAll('.question').forEach(sec => {
          if (sec.dataset.q !== 'source') paintScale(sec);
        });
        paintSource();

        show('state-form');
      } catch {
        show('state-not-found');
      }

      $('feedback-form').addEventListener('submit', onSubmit);
    }

    async function onSubmit(evt) {
      evt.preventDefault();
      const err = $('fb-error');
      err.classList.add('hidden');

      const missing = [];
      if (!state.experience) missing.push(t('missing_experience'));
      if (!state.service)    missing.push(t('missing_service'));
      if (!state.venue)      missing.push(t('missing_venue'));
      if (!state.rebook)     missing.push(t('missing_rebook'));
      if (!state.source)     missing.push(t('missing_source'));
      if (missing.length) {
        err.textContent = t('err_missing') + missing.join(', ') + '.';
        err.classList.remove('hidden');
        err.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const btn = $('btn-submit');
      btn.disabled = true; btn.textContent = t('submitting');

      const payload = {
        token: state.token,
        experience_rating: state.experience,
        experience_comment: $('c-experience').value.trim() || null,
        service_rating: state.service,
        service_comment: $('c-service').value.trim() || null,
        venue_rating: state.venue,
        venue_comment: $('c-venue').value.trim() || null,
        source: state.source,
        source_other: state.source === 'other' ? ($('c-source-other').value.trim() || null) : null,
        rebook_rating: state.rebook,
        rebook_comment: $('c-rebook').value.trim() || null,
      };

      try {
        const r = await fetch(FN_SUB, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error || 'server_error');
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
