#!/usr/bin/env python3
"""Generate the static M-HUB site (BG + EN) into site/.

All page content lives here so the two language versions never drift.
Run:  python3 build.py
"""
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")

# ---------------------------------------------------------------- data

# Building 2, floor 1 — from the commercial offer (July 2026). Prices excl. VAT.
UNITS = [
    # (name, wh_m2, wh_eur_m2, mezz_m2, mezz_eur_m2, yard_m2, yard_eur_m2, ideal_m2, total_eur, avg_eur_m2)
    (1, 509.29, 1310, 99.71, 1060, 1041.37, 280, 1220.93, 1064446.10, 1747.86),
    (2, 236.40, 1370, 66.36, 1060, 212.94, 280, 606.98, 453832.80, 1498.99),
    (3, 236.40, 1370, 66.36, 1060, 212.91, 280, 606.98, 453824.40, 1498.96),
    (4, 354.60, 1370, 99.96, 1060, 319.30, 280, 911.31, 681163.60, 1498.51),
    (5, 354.60, 1370, 99.96, 1060, 319.22, 280, 911.31, 681141.20, 1498.46),
    (6, 236.40, 1370, 66.36, 1060, 212.77, 280, 606.98, 453785.20, 1498.83),
    (7, 236.40, 1370, 66.36, 1060, 212.74, 280, 606.98, 453776.80, 1498.80),
    (8, 524.07, 1310, 99.71, 1060, 835.57, 280, 1250.56, 1026183.90, 1645.11),
]
TOT = dict(wh=2688.16, mezz=664.78, yard=3366.82, ideal=6722.03, price=5268154.00, avg=1571.20)
AREA_WH_MEZZ = 3352.94

ADDRESS_BG = "бул. „Ботевградско шосе“ 348, София"
ADDRESS_EN = "348 Botevgradsko Shose Blvd, Sofia, Bulgaria"
MAP_Q = "Botevgradsko%20shose%20348%2C%20Sofia%2C%20Bulgaria"


def num(v, lang, dec=2):
    """1041.37 -> '1 041,37' (bg) / '1,041.37' (en)"""
    s = f"{v:,.{dec}f}"
    if lang == "bg":
        s = s.replace(",", " ").replace(".", ",")
    return s


def eur(v, lang, dec=2):
    return (num(v, lang, dec) + " €") if lang == "bg" else ("€" + num(v, lang, dec))


def sqm(v, lang, dec=2):
    return num(v, lang, dec) + (" м²" if lang == "bg" else " m²")


# ---------------------------------------------------------------- i18n

NAV = {
    "bg": [("/bg/", "Начало"), ("/bg/parka/", "Паркът"), ("/bg/ploshti/", "Площи и цени"),
           ("/bg/lokatsiya/", "Локация"), ("/bg/kontakti/", "Контакти")],
    "en": [("/en/", "Home"), ("/en/the-park/", "The Park"), ("/en/units/", "Units & Prices"),
           ("/en/location/", "Location"), ("/en/contact/", "Contact")],
}
# path in one language -> counterpart in the other
COUNTERPART = {
    "/bg/": "/en/", "/bg/parka/": "/en/the-park/", "/bg/ploshti/": "/en/units/",
    "/bg/lokatsiya/": "/en/location/", "/bg/kontakti/": "/en/contact/",
    "/bg/kontakti/izprateno/": "/en/contact/sent/",
}
COUNTERPART.update({v: k for k, v in COUNTERPART.items()})

T = {
    "bg": dict(
        lang_other="EN", brand_tag="Warehouse & Logistic Park",
        foot_nav="Навигация", foot_docs="Документи", foot_offer="Търговска оферта — Сграда 2 (PDF)",
        foot_plan="Архитектурен план — Сграда 2 (PDF)", foot_addr=ADDRESS_BG,
        foot_note="Всички посочени цени са без включен ДДС.",
        cta_units="Площи и цени", cta_contact="Свържете се с нас",
        vat="Всички посочени цени са без включен ДДС.",
    ),
    "en": dict(
        lang_other="БГ", brand_tag="Warehouse & Logistic Park",
        foot_nav="Navigation", foot_docs="Documents", foot_offer="Commercial offer — Building 2 (PDF)",
        foot_plan="Architectural plan — Building 2 (PDF)", foot_addr=ADDRESS_EN,
        foot_note="All prices are quoted excluding VAT.",
        cta_units="Units & Prices", cta_contact="Contact us",
        vat="All prices are quoted excluding VAT.",
    ),
}

# ---------------------------------------------------------------- layout


def page(lang, path, title, desc, body, active):
    t = T[lang]
    other = COUNTERPART[path]
    active_attr = ' class="active"'
    nav = "\n        ".join(
        f'<a href="{href}"{active_attr if href == active else ""}>{label}</a>'
        for href, label in NAV[lang]
    )
    hreflang = (
        f'<link rel="alternate" hreflang="bg" href="https://m-hub.zone{path if lang=="bg" else other}">\n'
        f'  <link rel="alternate" hreflang="en" href="https://m-hub.zone{path if lang=="en" else other}">'
    )
    foot_nav = "\n            ".join(f'<li><a href="{href}">{label}</a></li>' for href, label in NAV[lang])
    year_note = "© 2026 M-HUB Warehouse &amp; Logistic Park"
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="https://m-hub.zone{path}">
  {hreflang}
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-in">
      <a class="brand" href="{NAV[lang][0][0]}"><img src="/assets/logo.png" alt="M-HUB Warehouse &amp; Logistic Park"></a>
      <nav class="main-nav">
        {nav}
        <a class="lang-switch" href="{other}">{t['lang_other']}</a>
      </nav>
    </div>
  </header>

{body}

  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand">M<span>-</span>HUB</div>
          <div class="footer-tag">{t['brand_tag']}</div>
          <p style="margin-top:16px">{t['foot_addr']}</p>
        </div>
        <div>
          <h4>{t['foot_nav']}</h4>
          <ul>
            {foot_nav}
          </ul>
        </div>
        <div>
          <h4>{t['foot_docs']}</h4>
          <ul>
            <li><a href="/assets/MHUB-Targovska-Oferta-Sgrada-2.pdf" download>{t['foot_offer']}</a></li>
            <li><a href="/assets/MHUB-Sgrada-2-Plan-Etazh-1.pdf" download>{t['foot_plan']}</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>{year_note}</span>
        <span>{t['foot_note']}</span>
      </div>
    </div>
  </footer>
</body>
</html>
"""


def write(path, html):
    full = os.path.join(ROOT, path.lstrip("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(html)
    print("wrote", full)


# ---------------------------------------------------------------- home

def home(lang):
    bg = lang == "bg"
    hero_badge = "Сграда 2 — в продажба · Завършване февруари 2027 г." if bg else \
                 "Building 2 — now selling · Completion February 2027"
    h1 = "Модерни складови и логистични площи в София" if bg else \
         "Modern warehouse &amp; logistic space in Sofia"
    lead = ("Складови и логистични площи с ясна ценова структура, преференциални условия "
            "и поетапна схема на плащане — на бул. „Ботевградско шосе“ 348.") if bg else \
           ("Warehouse and logistic units with a clear pricing structure, preferential terms "
            "and a staged payment plan — at 348 Botevgradsko Shose Blvd.")
    stats = [
        ("8", "склада в Сграда 2" if bg else "units in Building 2"),
        (sqm(TOT["wh"], lang), "складова площ" if bg else "warehouse floor area"),
        (sqm(TOT["mezz"], lang), "мецанин" if bg else "mezzanine level"),
        (sqm(TOT["yard"], lang), "прилежащи дворове" if bg else "private yards"),
    ]
    stats_html = "\n        ".join(
        f'<div class="stat"><div class="n">{n}</div><div class="l">{l}</div></div>' for n, l in stats)

    if bg:
        b1 = dict(title="Сграда 1", badge="Резервирана", cls="badge-reserved",
                  text="Всички складове в Сграда 1 са резервирани. Свържете се с нас, за да "
                       "получите информация при освобождаване на площ.",
                  rows=[("Статут", "Резервирана")],
                  cta='<a class="btn btn-line" href="/bg/kontakti/">Запитване</a>')
        b2 = dict(title="Сграда 2", badge="В продажба", cls="badge-sale",
                  text="8 функционални склада с мецанин и прилежащ двор. Разсрочено плащане "
                       "по етапи и преференциални условия при покупка на повече от един склад.",
                  rows=[("Складове", "8 бр. · 236–524 м²"),
                        ("Обща стойност", eur(TOT["price"], lang)),
                        ("Средна цена", num(TOT["avg"], lang) + " €/м²"),
                        ("Завършване", "февруари 2027 г.")],
                  cta='<a class="btn btn-gold" href="/bg/ploshti/">Виж площи и цени</a>')
        why_kicker, why_h2 = "Защо M-HUB", "Инвестиция в бъдещето"
        why = [
            ("📍", "Стратегическа локация", "Бул. „Ботевградско шосе“ 348 — със скорошна връзка към "
             "Околовръстния път, в близост до летището и в отлична логистична среда."),
            ("🏗️", "Функционални площи", "Складове от 236 до 524 м² с мецанин, прилежащ двор и "
             "паркоместа — готови да поемат склад, логистика или лек монтаж."),
            ("📑", "Ясни условия", "Прозрачна ценова структура без скрити разходи. Идеалните части "
             "се прехвърлят безплатно и не участват в продажната цена."),
            ("💶", "Разсрочено плащане", "30% при договор, 30% при Акт 14, 30% при Акт 15 и само "
             "10% след Акт 16 — плащате според напредъка на строителството."),
        ]
        cta_h2, cta_p = "Заявете оглед или оферта", \
            "Екипът ни ще ви съдейства с детайли за наличните складове, условията и схемата на плащане."
        title = "M-HUB Warehouse & Logistic Park — складови площи в София"
        desc = ("M-HUB Warehouse & Logistic Park — модерни складови и логистични площи на бул. "
                "Ботевградско шосе 348, София. Сграда 2 в продажба, завършване февруари 2027 г.")
    else:
        b1 = dict(title="Building 1", badge="Reserved", cls="badge-reserved",
                  text="All units in Building 1 are reserved. Get in touch to be notified "
                       "if a unit becomes available.",
                  rows=[("Status", "Reserved")],
                  cta='<a class="btn btn-line" href="/en/contact/">Enquire</a>')
        b2 = dict(title="Building 2", badge="Now selling", cls="badge-sale",
                  text="8 functional warehouse units with mezzanine and private yard. Staged "
                       "payment plan and preferential terms when buying more than one unit.",
                  rows=[("Units", "8 · 236–524 m²"),
                        ("Total value", eur(TOT["price"], lang)),
                        ("Average price", "€" + num(TOT["avg"], lang) + "/m²"),
                        ("Completion", "February 2027")],
                  cta='<a class="btn btn-gold" href="/en/units/">See units &amp; prices</a>')
        why_kicker, why_h2 = "Why M-HUB", "An investment in the future"
        why = [
            ("📍", "Strategic location", "348 Botevgradsko Shose Blvd — with an upcoming connection "
             "to the Sofia Ring Road, close to the airport, in an excellent logistics environment."),
            ("🏗️", "Functional units", "Warehouses from 236 to 524 m² with mezzanine, private yard "
             "and parking — ready for storage, logistics or light assembly."),
            ("📑", "Clear terms", "A transparent pricing structure with no hidden costs. Common "
             "(ideal) parts are transferred free of charge and are not part of the sale price."),
            ("💶", "Staged payments", "30% on contract, 30% at Act 14, 30% at Act 15 and only 10% "
             "after Act 16 — you pay as construction progresses."),
        ]
        cta_h2, cta_p = "Book a viewing or request an offer", \
            "Our team will assist you with details on available units, terms and the payment plan."
        title = "M-HUB Warehouse & Logistic Park — warehouse space in Sofia"
        desc = ("M-HUB Warehouse & Logistic Park — modern warehouse and logistic units at 348 "
                "Botevgradsko Shose Blvd, Sofia. Building 2 now selling, completion February 2027.")

    def bldg_card(b, reserved=False):
        rows = "\n            ".join(f"<li>{k} <b>{v}</b></li>" for k, v in b["rows"])
        return f"""<div class="card bldg{' reserved' if reserved else ''}">
          <div class="bldg-top"><h3>{b['title']}</h3><span class="badge {b['cls']}">{b['badge']}</span></div>
          <p>{b['text']}</p>
          <ul>
            {rows}
          </ul>
          <div class="cta-row">{b['cta']}</div>
        </div>"""

    why_html = "\n        ".join(
        f'<div class="card"><div class="icon">{i}</div><h3>{h}</h3><p>{p}</p></div>' for i, h, p in why)

    body = f"""  <section class="hero">
    <div class="container">
      <span class="hero-badge"><span class="dot"></span>{hero_badge}</span>
      <h1>{h1}</h1>
      <p class="lead">{lead}</p>
      <div class="hero-cta">
        <a class="btn btn-gold" href="{NAV[lang][2][0]}">{T[lang]['cta_units']}</a>
        <a class="btn btn-ghost" href="{NAV[lang][4][0]}">{T[lang]['cta_contact']}</a>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="container">
      <span class="kicker">{'Паркът в числа' if bg else 'The park in numbers'}</span>
      <h2>{'Сграда 2 — етап 2' if bg else 'Building 2 — phase 2'}</h2>
      <div class="stats">
        {stats_html}
      </div>
    </div>
  </section>

  <section class="block tint">
    <div class="container">
      <span class="kicker">{'Сгради' if bg else 'Buildings'}</span>
      <h2>{'Наличност в парка' if bg else 'Availability in the park'}</h2>
      <div class="grid-2">
        {bldg_card(b1, reserved=True)}
        {bldg_card(b2)}
      </div>
    </div>
  </section>

  <section class="block">
    <div class="container">
      <span class="kicker">{why_kicker}</span>
      <h2>{why_h2}</h2>
      <div class="grid-2">
        {why_html}
      </div>
    </div>
  </section>

  <section class="cta-band">
    <div class="container">
      <h2>{cta_h2}</h2>
      <p>{cta_p}</p>
      <a class="btn btn-gold" href="{NAV[lang][4][0]}">{T[lang]['cta_contact']}</a>
    </div>
  </section>
"""
    return page(lang, NAV[lang][0][0], title, desc, body, NAV[lang][0][0])


# ---------------------------------------------------------------- units / prices

def units_page(lang):
    bg = lang == "bg"
    path = "/bg/ploshti/" if bg else "/en/units/"

    head = {
        True: ("Склад", "€/м²", "Мецанин", "€/м²", "Двор", "€/м²", "Идеални части", "Обща цена", "Средна €/м²"),
        False: ("Warehouse", "€/m²", "Mezzanine", "€/m²", "Yard", "€/m²", "Ideal parts", "Total price", "Avg €/m²"),
    }[bg]
    unit_word = "Склад" if bg else "Unit"
    rows = []
    for (n, wh, whp, mz, mzp, yd, ydp, idp, total, avg) in UNITS:
        rows.append(
            f"<tr><td>{unit_word} {n}</td>"
            f"<td>{num(wh, lang)}</td><td>{num(whp, lang, 0)}</td>"
            f"<td>{num(mz, lang)}</td><td>{num(mzp, lang, 0)}</td>"
            f"<td>{num(yd, lang)}</td><td>{num(ydp, lang, 0)}</td>"
            f"<td>{num(idp, lang)}</td>"
            f"<td class=\"total\">{num(total, lang)}</td><td>{num(avg, lang)}</td></tr>")
    rows_html = "\n            ".join(rows)
    foot = (f"<tr><td>{'ОБЩО' if bg else 'TOTAL'}</td>"
            f"<td>{num(TOT['wh'], lang)}</td><td></td>"
            f"<td>{num(TOT['mezz'], lang)}</td><td></td>"
            f"<td>{num(TOT['yard'], lang)}</td><td></td>"
            f"<td>{num(TOT['ideal'], lang)}</td>"
            f"<td>{num(TOT['price'], lang)}</td><td>{num(TOT['avg'], lang)}</td></tr>")

    if bg:
        title = "Площи и цени — M-HUB Warehouse & Logistic Park"
        desc = ("Актуални цени на складовете в Сграда 2 на M-HUB Warehouse & Logistic Park, София. "
                "8 склада с мецанин и двор, разсрочено плащане, завършване февруари 2027 г.")
        hero_k, hero_h = "Площи и цени", "Търговска оферта — Сграда 2"
        hero_p = ("Осем функционални склада с мецанин, прилежащ двор и безплатно прехвърляне на "
                  "идеалните части. Всички цени са без включен ДДС.")
        res_h, res_p = "Сграда 1 — резервирана", \
            ("Всички складове в Сграда 1 са резервирани. Ако желаете да бъдете уведомени при "
             "освобождаване на площ, оставете запитване.")
        res_cta = '<a class="btn btn-dark" href="/bg/kontakti/">Оставете запитване</a>'
        chips = [("Завършване", "февруари 2027 г."), ("Цени", "без ДДС"),
                 ("Идеални части", "безплатно прехвърляне")]
        tiles = [("Обща стойност", eur(TOT["price"], lang)),
                 ("Площ склад + мецанин", sqm(AREA_WH_MEZZ, lang)),
                 ("Средна цена", num(TOT["avg"], lang) + " €/м²")]
        plan_k, plan_h = "Архитектура", "Разпределение — етаж 1"
        plan_sub = ("Застроена площ 2 688,16 м² — осем склада с мецанин, самостоятелни входове "
                    "и прилежащи дворове.")
        plan_cap = "Сграда 2 · Етаж 1 · Проект: m2A architecture"
        plan_dl = "Изтегли плана (PDF)"
        tbl_note = ("Идеалните части се прехвърлят безплатно и не участват в общата продажна цена. "
                    "Средната цена е изчислена върху площта на склад + мецанин.")
        pay_k, pay_h = "Схема на плащане", "Плащате според напредъка"
        steps = [("30%", "при подписване на договор"), ("30%", "при Акт 14"),
                 ("30%", "при Акт 15"), ("10%", "след Акт 16")]
        promo_h = "Специални търговски условия"
        promo_p = ("<b>3% отстъпка</b> при покупка на втори склад и <b>6% отстъпка</b> при покупка на "
                   "трети склад. Отстъпката се прилага върху продажната цена на съответния склад и "
                   "не се комбинира с други промоционални условия.")
        offer_txt = ("Изтеглете пълната търговска оферта за Сграда 2 — цени по обекти, схема на "
                     "плащане и условия.")
        offer_btn = "Търговска оферта (PDF)"
        tbl_k, tbl_h = "Ценова листа", "Складове в Сграда 2"
    else:
        title = "Units & Prices — M-HUB Warehouse & Logistic Park"
        desc = ("Current prices for the warehouse units in Building 2 of M-HUB Warehouse & Logistic "
                "Park, Sofia. 8 units with mezzanine and yard, staged payments, completion Feb 2027.")
        hero_k, hero_h = "Units & Prices", "Commercial offer — Building 2"
        hero_p = ("Eight functional warehouse units with mezzanine, private yard and free transfer "
                  "of the ideal parts. All prices exclude VAT.")
        res_h, res_p = "Building 1 — reserved", \
            ("All units in Building 1 are reserved. Leave an enquiry if you would like to be "
             "notified when a unit becomes available.")
        res_cta = '<a class="btn btn-dark" href="/en/contact/">Leave an enquiry</a>'
        chips = [("Completion", "February 2027"), ("Prices", "excl. VAT"),
                 ("Ideal parts", "transferred free of charge")]
        tiles = [("Total value", eur(TOT["price"], lang)),
                 ("Warehouse + mezzanine area", sqm(AREA_WH_MEZZ, lang)),
                 ("Average price", "€" + num(TOT["avg"], lang) + "/m²")]
        plan_k, plan_h = "Architecture", "Floor plan — level 1"
        plan_sub = ("Built-up area of 2,688.16 m² — eight units with mezzanine, individual "
                    "entrances and private yards.")
        plan_cap = "Building 2 · Level 1 · Design: m2A architecture"
        plan_dl = "Download the plan (PDF)"
        tbl_note = ("The ideal parts are transferred free of charge and are not included in the "
                    "total sale price. The average price is calculated on warehouse + mezzanine area.")
        pay_k, pay_h = "Payment plan", "Pay as construction progresses"
        steps = [("30%", "on signing the contract"), ("30%", "at Act 14 (structure)"),
                 ("30%", "at Act 15"), ("10%", "after Act 16 (use permit)")]
        promo_h = "Special commercial terms"
        promo_p = ("<b>3% discount</b> on the purchase of a second unit and <b>6% discount</b> on a "
                   "third unit. The discount applies to the sale price of the respective unit and "
                   "cannot be combined with other promotions.")
        offer_txt = ("Download the full commercial offer for Building 2 — unit prices, payment "
                     "plan and terms.")
        offer_btn = "Commercial offer (PDF)"
        tbl_k, tbl_h = "Price list", "Units in Building 2"

    chips_html = "".join(f'<span class="chip">{k}: <b>{v}</b></span>' for k, v in chips)
    tiles_html = "\n        ".join(
        f'<div class="tile"><div class="t">{t}</div><div class="v">{v}</div></div>' for t, v in tiles)
    steps_html = "\n        ".join(
        f'<div class="step"><div class="pct">{p}</div><div class="when">{w}</div></div>' for p, w in steps)
    head_html = f"<th>{'Обект' if bg else 'Unit'}</th>" + "".join(f"<th>{h}</th>" for h in head)

    body = f"""  <section class="page-hero">
    <div class="container">
      <span class="kicker" style="color:var(--gold-soft)">{hero_k}</span>
      <h1>{hero_h}</h1>
      <p>{hero_p}</p>
    </div>
  </section>

  <section class="block" style="padding-bottom:30px">
    <div class="container">
      <div class="reserved-strip">
        <div>
          <span class="badge badge-reserved">{'Резервирана' if bg else 'Reserved'}</span>
          <h3 style="margin-top:14px">{res_h}</h3>
          <p>{res_p}</p>
        </div>
        {res_cta}
      </div>
    </div>
  </section>

  <section class="block" style="padding-top:30px">
    <div class="container">
      <span class="kicker">{'Сграда 2' if bg else 'Building 2'}</span>
      <h2>{tbl_h}</h2>
      <div class="chips">{chips_html}</div>

      <div class="table-wrap">
        <table class="price">
          <thead><tr>{head_html}</tr></thead>
          <tbody>
            {rows_html}
          </tbody>
          <tfoot>{foot}</tfoot>
        </table>
      </div>
      <p class="tbl-note">{tbl_note} {'Площите са в м², цените — в евро.' if bg else 'Areas in m², prices in EUR.'}</p>

      <div class="tiles">
        {tiles_html}
      </div>

      <div class="offer-note">
        <p><b>{promo_h}.</b> {promo_p}</p>
        <a class="btn btn-gold" href="/assets/MHUB-Targovska-Oferta-Sgrada-2.pdf" download>{offer_btn}</a>
      </div>
    </div>
  </section>

  <section class="block tint">
    <div class="container">
      <span class="kicker">{pay_k}</span>
      <h2>{pay_h}</h2>
      <div class="steps">
        {steps_html}
      </div>
    </div>
  </section>

  <section class="block">
    <div class="container">
      <span class="kicker">{plan_k}</span>
      <h2>{plan_h}</h2>
      <p class="sub">{plan_sub}</p>
      <figure class="plan-fig">
        <a href="/assets/plan-sgrada2-et1.png" target="_blank" rel="noopener">
          <img src="/assets/plan-sgrada2-et1-1200.png"
               srcset="/assets/plan-sgrada2-et1-1200.png 1200w, /assets/plan-sgrada2-et1.png 2400w"
               sizes="(max-width: 1180px) 100vw, 1136px"
               alt="{plan_cap}" loading="lazy">
        </a>
        <figcaption>
          <span>{plan_cap}</span>
          <a class="dl" href="/assets/MHUB-Sgrada-2-Plan-Etazh-1.pdf" download>{plan_dl} ↓</a>
        </figcaption>
      </figure>
      <p style="margin-top:26px">{offer_txt}</p>
    </div>
  </section>
"""
    return page(lang, path, title, desc, body, path)


# ---------------------------------------------------------------- the park

def park(lang):
    bg = lang == "bg"
    path = "/bg/parka/" if bg else "/en/the-park/"
    if bg:
        title = "Паркът — M-HUB Warehouse & Logistic Park"
        desc = ("M-HUB Warehouse & Logistic Park — модерен складов и логистичен парк в София: "
                "функционални складове с мецанин, прилежащи дворове и паркоместа.")
        hero_k, hero_h = "Паркът", "Модерен складов и логистичен парк"
        hero_p = ("M-HUB обединява функционални складови площи, прилежащи дворове и удобен достъп "
                  "в единна, добре планирана среда за бизнес.")
        f_list = [
            ("🏭", "Складове с мецанин", "Всеки склад разполага с мецанинен етаж за офис или допълнително "
             "съхранение, самостоятелен вход и санитарен възел."),
            ("🚚", "Прилежащи дворове", "Индивидуален двор към всеки склад — от 213 до 1 041 м² — за "
             "маневриране, товаро-разтоварни дейности и паркиране."),
            ("🅿️", "Паркоместа", "Обособени паркоместа пред складовете за служители и посетители."),
            ("🔑", "Самостоятелност", "Идеалните части се прехвърлят безплатно — придобивате завършен, "
             "самостоятелен актив без скрити разходи."),
        ]
        spec_h = "Сграда 2 — технически данни"
        specs = [("Застроена площ (ет. 1)", sqm(2688.16, lang)),
                 ("Брой складове", "8"),
                 ("Складови площи", "236,40 – 524,07 м²"),
                 ("Мецанин (общо)", sqm(TOT["mezz"], lang)),
                 ("Дворове (общо)", sqm(TOT["yard"], lang)),
                 ("Завършване", "февруари 2027 г.")]
        tl_h = "Етапи на парка"
        timeline = [("Сграда 1", "Резервирана — всички площи са заети.", "badge-reserved", "Резервирана"),
                    ("Сграда 2", "В активна продажба. Завършване: февруари 2027 г.", "badge-sale", "В продажба")]
        cta_h = "Разгледайте наличните площи"
        cta_p = "Вижте актуалната ценова листа и разпределението на Сграда 2."
        cta_btn = "Площи и цени"
    else:
        title = "The Park — M-HUB Warehouse & Logistic Park"
        desc = ("M-HUB Warehouse & Logistic Park — a modern warehouse and logistics park in Sofia: "
                "functional units with mezzanine, private yards and parking.")
        hero_k, hero_h = "The Park", "A modern warehouse &amp; logistics park"
        hero_p = ("M-HUB combines functional warehouse space, private yards and convenient access "
                  "in a single, well-planned business environment.")
        f_list = [
            ("🏭", "Units with mezzanine", "Every unit has a mezzanine level for offices or extra storage, "
             "its own entrance and sanitary facilities."),
            ("🚚", "Private yards", "An individual yard for each unit — from 213 to 1,041 m² — for "
             "manoeuvring, loading and parking."),
            ("🅿️", "Parking", "Dedicated parking spaces in front of the units for staff and visitors."),
            ("🔑", "Self-contained assets", "Ideal parts are transferred free of charge — you acquire a "
             "complete, self-contained asset with no hidden costs."),
        ]
        spec_h = "Building 2 — key figures"
        specs = [("Built-up area (level 1)", sqm(2688.16, lang)),
                 ("Number of units", "8"),
                 ("Unit sizes", "236.40 – 524.07 m²"),
                 ("Mezzanine (total)", sqm(TOT["mezz"], lang)),
                 ("Yards (total)", sqm(TOT["yard"], lang)),
                 ("Completion", "February 2027")]
        tl_h = "Park phases"
        timeline = [("Building 1", "Reserved — all units are taken.", "badge-reserved", "Reserved"),
                    ("Building 2", "Now selling. Completion: February 2027.", "badge-sale", "Now selling")]
        cta_h = "Browse the available units"
        cta_p = "See the current price list and the floor plan of Building 2."
        cta_btn = "Units & Prices"

    f_html = "\n        ".join(
        f'<div class="card"><div class="icon">{i}</div><h3>{h}</h3><p>{p}</p></div>' for i, h, p in f_list)
    spec_html = "\n            ".join(f"<li>{k} <b>{v}</b></li>" for k, v in specs)
    tl_html = "\n        ".join(
        f'<div class="card bldg"><div class="bldg-top"><h3>{t}</h3>'
        f'<span class="badge {cls}">{b}</span></div><p>{p}</p></div>'
        for t, p, cls, b in timeline)

    body = f"""  <section class="page-hero">
    <div class="container">
      <span class="kicker" style="color:var(--gold-soft)">{hero_k}</span>
      <h1>{hero_h}</h1>
      <p>{hero_p}</p>
    </div>
  </section>

  <section class="block">
    <div class="container">
      <div class="grid-2">
        {f_html}
      </div>
    </div>
  </section>

  <section class="block tint">
    <div class="container">
      <span class="kicker">{'Технически данни' if bg else 'Key figures'}</span>
      <h2>{spec_h}</h2>
      <div class="grid-2">
        <div class="card bldg">
          <ul style="margin-top:4px">
            {spec_html}
          </ul>
        </div>
        <div>
          <div class="grid-2" style="margin-top:0;grid-template-columns:1fr">
        {tl_html}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="cta-band">
    <div class="container">
      <h2>{cta_h}</h2>
      <p>{cta_p}</p>
      <a class="btn btn-gold" href="{NAV[lang][2][0]}">{cta_btn}</a>
    </div>
  </section>
"""
    return page(lang, path, title, desc, body, path)


# ---------------------------------------------------------------- location

def location(lang):
    bg = lang == "bg"
    path = "/bg/lokatsiya/" if bg else "/en/location/"
    if bg:
        title = "Локация — M-HUB Warehouse & Logistic Park"
        desc = ("M-HUB Warehouse & Logistic Park се намира на бул. Ботевградско шосе 348, София — "
                "със скорошна връзка към Околовръстния път и в близост до Летище София.")
        hero_k, hero_h = "Локация", "Бул. „Ботевградско шосе“ 348, София"
        hero_p = "Отлична логистична среда на един от основните входно-изходни булеварди на София."
        pts = [
            ("📍", "<b>Адрес:</b> бул. „Ботевградско шосе“ 348, София"),
            ("🛣️", "<b>Околовръстен път</b> — скорошна директна връзка към Софийския околовръстен път"),
            ("✈️", "<b>Летище София</b> — в непосредствена близост"),
            ("🚛", "<b>Логистична среда</b> — установена индустриална и логистична зона с отличен достъп за тежкотоварен транспорт"),
        ]
        map_h = "Вижте ни на картата"
    else:
        title = "Location — M-HUB Warehouse & Logistic Park"
        desc = ("M-HUB Warehouse & Logistic Park is located at 348 Botevgradsko Shose Blvd, Sofia — "
                "with an upcoming Ring Road connection and close to Sofia Airport.")
        hero_k, hero_h = "Location", "348 Botevgradsko Shose Blvd, Sofia"
        hero_p = "An excellent logistics environment on one of Sofia's main arterial boulevards."
        pts = [
            ("📍", "<b>Address:</b> 348 Botevgradsko Shose Blvd, Sofia, Bulgaria"),
            ("🛣️", "<b>Ring Road</b> — upcoming direct connection to the Sofia Ring Road"),
            ("✈️", "<b>Sofia Airport</b> — in close proximity"),
            ("🚛", "<b>Logistics environment</b> — an established industrial and logistics zone with excellent heavy-vehicle access"),
        ]
        map_h = "Find us on the map"

    pts_html = "\n            ".join(f'<li><span class="ic">{i}</span><span>{t}</span></li>' for i, t in pts)
    body = f"""  <section class="page-hero">
    <div class="container">
      <span class="kicker" style="color:var(--gold-soft)">{hero_k}</span>
      <h1>{hero_h}</h1>
      <p>{hero_p}</p>
    </div>
  </section>

  <section class="block">
    <div class="container">
      <span class="kicker">{hero_k}</span>
      <h2>{map_h}</h2>
      <div class="loc-grid">
        <div class="map-frame">
          <iframe src="https://www.google.com/maps?q={MAP_Q}&output=embed" loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                  title="M-HUB Warehouse &amp; Logistic Park — {'карта' if bg else 'map'}"></iframe>
        </div>
        <div>
          <ul class="loc-list">
            {pts_html}
          </ul>
          <div style="margin-top:26px">
            <a class="btn btn-gold" href="{NAV[lang][4][0]}">{T[lang]['cta_contact']}</a>
          </div>
        </div>
      </div>
    </div>
  </section>
"""
    return page(lang, path, title, desc, body, path)


# ---------------------------------------------------------------- contact

def contact(lang):
    bg = lang == "bg"
    path = "/bg/kontakti/" if bg else "/en/contact/"
    if bg:
        title = "Контакти — M-HUB Warehouse & Logistic Park"
        desc = ("Свържете се с екипа на M-HUB Warehouse & Logistic Park — запитвания за складове, "
                "огледи и търговски условия.")
        hero_k, hero_h = "Контакти", "Свържете се с нас"
        hero_p = ("Изпратете запитване за склад, оглед или търговски условия — ще се свържем с вас "
                  "възможно най-бързо.")
        l_name, l_email, l_phone, l_int, l_msg = "Име и фамилия", "Имейл", "Телефон", "Интерес към", "Съобщение"
        opt_general = "Общо запитване"
        opt_b1 = "Сграда 1 (листа на чакащи)"
        unit_word = "Склад"
        send = "Изпрати запитване"
        hint = "Полетата, отбелязани с *, са задължителни."
        addr_h = "Адрес"
        action = "/bg/kontakti/izprateno/"
    else:
        title = "Contact — M-HUB Warehouse & Logistic Park"
        desc = ("Contact the M-HUB Warehouse & Logistic Park team — enquiries about units, "
                "viewings and commercial terms.")
        hero_k, hero_h = "Contact", "Get in touch"
        hero_p = ("Send an enquiry about a unit, a viewing or commercial terms — we will get back "
                  "to you as soon as possible.")
        l_name, l_email, l_phone, l_int, l_msg = "Full name", "Email", "Phone", "Interested in", "Message"
        opt_general = "General enquiry"
        opt_b1 = "Building 1 (waiting list)"
        unit_word = "Unit"
        send = "Send enquiry"
        hint = "Fields marked with * are required."
        addr_h = "Address"
        action = "/en/contact/sent/"

    opts = [opt_general] + [f"{'Сграда 2 — ' if bg else 'Building 2 — '}{unit_word} {n}" for (n, *_ ) in UNITS] + [opt_b1]
    opts_html = "\n                ".join(f'<option>{o}</option>' for o in opts)

    body = f"""  <section class="page-hero">
    <div class="container">
      <span class="kicker" style="color:var(--gold-soft)">{hero_k}</span>
      <h1>{hero_h}</h1>
      <p>{hero_p}</p>
    </div>
  </section>

  <section class="block">
    <div class="container">
      <span class="kicker">{addr_h}</span>
      <h2 style="font-size:1.3rem">{ADDRESS_BG if bg else ADDRESS_EN}</h2>

      <form class="form-card" name="contact" method="POST" action="{action}"
            data-netlify="true" netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="contact">
        <p style="display:none"><label>Do not fill: <input name="bot-field"></label></p>
        <input type="hidden" name="lang" value="{lang}">
        <div class="form-grid">
          <div class="field">
            <label for="f-name">{l_name} *</label>
            <input id="f-name" name="name" type="text" required autocomplete="name">
          </div>
          <div class="field">
            <label for="f-email">{l_email} *</label>
            <input id="f-email" name="email" type="email" required autocomplete="email">
          </div>
          <div class="field">
            <label for="f-phone">{l_phone}</label>
            <input id="f-phone" name="phone" type="tel" autocomplete="tel">
          </div>
          <div class="field">
            <label for="f-interest">{l_int}</label>
            <select id="f-interest" name="interest">
                {opts_html}
            </select>
          </div>
          <div class="field full">
            <label for="f-msg">{l_msg} *</label>
            <textarea id="f-msg" name="message" rows="6" required></textarea>
          </div>
        </div>
        <div class="form-foot">
          <button class="btn btn-gold" type="submit">{send}</button>
          <span class="hint">{hint}</span>
        </div>
      </form>
    </div>
  </section>
"""
    return page(lang, path, title, desc, body, path)


def thanks(lang):
    bg = lang == "bg"
    path = "/bg/kontakti/izprateno/" if bg else "/en/contact/sent/"
    if bg:
        title = "Благодарим — M-HUB Warehouse & Logistic Park"
        h, p, btn = "Благодарим ви!", "Запитването ви е изпратено успешно. Ще се свържем с вас възможно най-бързо.", "Обратно към началото"
        back = "/bg/"
    else:
        title = "Thank you — M-HUB Warehouse & Logistic Park"
        h, p, btn = "Thank you!", "Your enquiry has been sent successfully. We will get back to you as soon as possible.", "Back to home"
        back = "/en/"
    body = f"""  <section class="thanks">
    <div class="container">
      <div class="card">
        <div class="tick">✓</div>
        <h2>{h}</h2>
        <p style="margin:14px 0 26px;color:var(--ink-soft)">{p}</p>
        <a class="btn btn-gold" href="{back}">{btn}</a>
      </div>
    </div>
  </section>
"""
    return page(lang, path, title, title, body, "")


# ---------------------------------------------------------------- root & config

FAVICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#16130d"/>
  <path d="M14 48V17l12 15 6-8 6 8 12-15v31h-7V33l-8 10h-6l-8-10v15z" fill="#fbf7ee"/>
  <rect x="30.5" y="24" width="3" height="24" fill="#b28a33"/>
</svg>
"""

ROOT_INDEX = """<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <title>M-HUB Warehouse &amp; Logistic Park</title>
  <meta http-equiv="refresh" content="0; url=/bg/">
  <link rel="canonical" href="https://m-hub.zone/bg/">
</head>
<body>
  <p><a href="/bg/">Български</a> · <a href="/en/">English</a></p>
</body>
</html>
"""

REDIRECTS = """# Language-aware root redirect (Netlify)
/   /en/   302   Language=en
/   /bg/   302
"""

NETLIFY_TOML = """# M-HUB Warehouse & Logistic Park — Netlify config
# Redirects live in site/_redirects, headers in site/_headers so that
# drag-and-drop deploys of the site/ folder behave identically.
[build]
  publish = "site"
"""

HEADERS = """/assets/*
  Cache-Control: public, max-age=604800

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
"""


def main():
    for lang in ("bg", "en"):
        write(NAV[lang][0][0] + "index.html", home(lang))
        write(("/bg/ploshti/" if lang == "bg" else "/en/units/") + "index.html", units_page(lang))
        write(("/bg/parka/" if lang == "bg" else "/en/the-park/") + "index.html", park(lang))
        write(("/bg/lokatsiya/" if lang == "bg" else "/en/location/") + "index.html", location(lang))
        write(("/bg/kontakti/" if lang == "bg" else "/en/contact/") + "index.html", contact(lang))
        write(("/bg/kontakti/izprateno/" if lang == "bg" else "/en/contact/sent/") + "index.html", thanks(lang))
    write("/index.html", ROOT_INDEX)
    write("/assets/favicon.svg", FAVICON)
    write("/_redirects", REDIRECTS)
    write("/_headers", HEADERS)
    with open(os.path.join(os.path.dirname(ROOT), "netlify.toml"), "w", encoding="utf-8") as f:
        f.write(NETLIFY_TOML)
    print("wrote netlify.toml")


if __name__ == "__main__":
    main()
