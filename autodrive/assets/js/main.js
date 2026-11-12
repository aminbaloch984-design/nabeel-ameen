/* ==========================================================
   AutoDrive PK — shared behaviour
   Vanilla JS, no build step. Works from file:// too.
   ========================================================== */
(function () {
  "use strict";

  /* ---------- tiny helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const cars = window.CARS || [];
  const site = window.SITE || {};
  const money = (n) => "PKR " + Number(n).toLocaleString("en-PK");
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function shortPrice(n) {
    if (n >= 10000000) {
      const v = n / 10000000;
      return "PKR " + (v % 1 === 0 ? v : v.toFixed(2).replace(/0$/, "")) + " Crore";
    }
    if (n >= 100000) {
      const v = n / 100000;
      return "PKR " + (v % 1 === 0 ? v : v.toFixed(1)) + " Lacs";
    }
    return money(n);
  }

  function monthly(price) {
    const f = site.finance || { downPayment: 0.3, years: 5, annualRate: 0.18 };
    const principal = price * (1 - f.downPayment);
    const r = f.annualRate / 12;
    const n = f.years * 12;
    const m = (principal * r) / (1 - Math.pow(1 + r, -n));
    return Math.round(m / 100) * 100;
  }

  const waLink = (text) =>
    "https://wa.me/" + site.whatsapp + "?text=" + encodeURIComponent(text || "Assalam o Alaikum, I am interested in a car listed on AutoDrive PK.");

  /* ---------- icons ---------- */
  const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14 8 10"/><path d="M3.5 18a9 9 0 1 1 17 0"/><circle cx="12" cy="14" r="1.6"/></svg>',
    fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12"/><path d="M14 9h3a2 2 0 0 1 2 2v5a2 2 0 0 0 4 0V8l-3-3"/><path d="M6 8h6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16M12 4v16M18 4v16M6 9h12M6 15h12"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.2-2.8 7.8-7 9-4.2-1.2-7-4.8-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2 22l5.36-1.4a9.9 9.9 0 0 0 4.68 1.2h.01c5.43 0 9.84-4.4 9.84-9.84A9.78 9.78 0 0 0 12.04 2Zm0 17.96a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.1.81.83-3.03-.2-.31a8.13 8.13 0 0 1-1.25-4.33c0-4.5 3.67-8.17 8.2-8.17a8.14 8.14 0 0 1 8.17 8.18c0 4.5-3.67 8.17-8.17 8.17Zm4.5-6.12c-.25-.13-1.46-.72-1.69-.8-.23-.09-.4-.13-.56.12-.17.25-.65.8-.8.96-.14.17-.29.19-.54.06a6.6 6.6 0 0 1-1.94-1.2 7.3 7.3 0 0 1-1.34-1.67c-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.83-.2-.48-.4-.42-.56-.42h-.47c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.72 2.74 4.2 3.74.58.25 1.04.4 1.4.51.6.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.2-.58.2-1.07.14-1.18-.06-.1-.23-.17-.48-.3Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L15 13l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 5.2 2 2 0 0 1 5 3Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M4 17V11l2-5h12l2 5v6"/><path d="M3 17h18"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
    shieldStar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.2-2.8 7.8-7 9-4.2-1.2-7-4.8-7-9V6l7-3Z"/><path d="m12 8 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4Z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
  };

  /* ---------- toast ---------- */
  let toastEl = null;
  let toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 3200);
  }

  /* ---------- header / nav ---------- */
  function initNav() {
    const toggle = $(".nav-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    $$(".nav a").forEach((a) =>
      a.addEventListener("click", () => {
        document.body.classList.remove("nav-open");
        $(".nav-toggle")?.setAttribute("aria-expanded", "false");
      })
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") document.body.classList.remove("nav-open");
    });
  }

  /* ---------- reveal on scroll ---------- */
  function initReveal() {
    const items = $$(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -60px 0px", threshold: 0.08 }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ---------- car card markup ---------- */
  function carCard(car) {
    const badgeClass = car.badge === "Featured" ? "badge--red" : car.badge === "Verified" ? "badge--green" : "";
    const href = "car.html?id=" + encodeURIComponent(car.id);
    return `
      <article class="car-card reveal">
        <a class="car-card__media" href="${href}" aria-label="${esc(car.year + " " + car.make + " " + car.model)}">
          <img src="${car.image}" alt="${esc(car.year + " " + car.make + " " + car.model)}" loading="lazy" onerror="this.style.visibility='hidden'">
          <div class="car-card__tags">
            <span class="badge ${badgeClass}">${ICONS.shield} ${esc(car.badge)}</span>
            <span class="badge">${esc(car.condition)}</span>
          </div>
        </a>
        <div class="car-card__body">
          <div class="car-card__head">
            <h3 class="car-card__title"><a href="${href}">${esc(car.year)} ${esc(car.make)} ${esc(car.model)}</a></h3>
            <p class="car-card__meta">
              <span>${esc(car.area)}, ${esc(car.city)}</span>
              <span class="dot"></span>
              <span>${esc(car.registered)} registered</span>
            </p>
          </div>
          <div class="car-card__specs">
            <span class="spec-chip">${ICONS.gauge} ${Number(car.mileage).toLocaleString("en-PK")} km</span>
            <span class="spec-chip">${ICONS.fuel} ${esc(car.fuel)}</span>
            <span class="spec-chip">${ICONS.gear} ${esc(car.transmission)}</span>
          </div>
          <div class="car-card__foot">
            <div class="car-card__price">
              ${shortPrice(car.price)}
              <span>${money(car.price)} · from ${money(monthly(car.price))}/mo</span>
            </div>
            <a class="btn btn--sm" href="${href}">View details</a>
          </div>
        </div>
      </article>`;
  }

  function carCardCompact(car) {
    return `
      <a class="car-card__compact" href="car.html?id=${encodeURIComponent(car.id)}" style="display:flex;gap:12px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:11px;background:#14141a">
        <img src="${car.image}" alt="" loading="lazy" style="width:74px;height:56px;border-radius:8px;object-fit:cover;flex:none" onerror="this.style.visibility='hidden'">
        <span style="min-width:0">
          <span style="display:block;font-size:.83rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(car.year)} ${esc(car.make)} ${esc(car.model)}</span>
          <span style="display:block;font-size:.74rem;color:var(--muted);margin-top:2px">${esc(car.city)} · ${Number(car.mileage).toLocaleString("en-PK")} km</span>
          <span style="display:block;font-size:.8rem;font-weight:700;margin-top:3px">${shortPrice(car.price)}</span>
        </span>
      </a>`;
  }

  /* ---------- home ---------- */
  function initHome() {
    const grid = $("#featured-grid");
    if (grid && cars.length) {
      grid.innerHTML = cars.slice(0, 6).map(carCard).join("");
    }

    const brandGrid = $("#brand-grid");
    if (brandGrid) {
      brandGrid.innerHTML = (window.BRANDS || [])
        .map(
          (b) => `
        <a class="brand-tile" href="inventory.html?make=${encodeURIComponent(b.name)}">
          <span class="brand-tile__avatar">${esc(b.name.slice(0, 2).toUpperCase())}</span>
          <span>
            <span class="brand-tile__name">${esc(b.name)}</span>
            <span class="brand-tile__count">${Number(b.count).toLocaleString("en-PK")} listings</span>
          </span>
        </a>`
        )
        .join("");
    }

    const form = $("#home-search");
    if (form) {
      const makes = Array.from(new Set(cars.map((c) => c.make))).sort();
      const makeSel = $("#hs-make");
      makes.forEach((m) => makeSel.insertAdjacentHTML("beforeend", `<option value="${esc(m)}">${esc(m)}</option>`));
      const citySel = $("#hs-city");
      (window.CITIES || []).forEach((c) => citySel.insertAdjacentHTML("beforeend", `<option value="${esc(c)}">${esc(c)}</option>`));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const p = new URLSearchParams();
        if ($("#hs-keyword").value.trim()) p.set("q", $("#hs-keyword").value.trim());
        if (makeSel.value) p.set("make", makeSel.value);
        if (citySel.value) p.set("city", citySel.value);
        if ($("#hs-price").value) p.set("priceMax", $("#hs-price").value);
        window.location.href = "inventory.html" + (p.toString() ? "?" + p.toString() : "");
      });
    }

    initCalculator();
  }

  function initCalculator() {
    const price = $("#calc-price");
    if (!price) return;
    const down = $("#calc-down");
    const years = $("#calc-years");
    const rate = $("#calc-rate");
    const out = $("#calc-monthly");
    const financed = $("#calc-financed");
    const upfront = $("#calc-upfront");
    const priceOut = $("#calc-price-out");
    const downOut = $("#calc-down-out");
    const yearsOut = $("#calc-years-out");
    const rateOut = $("#calc-rate-out");

    const update = () => {
      const p = Number(price.value);
      const d = Number(down.value) / 100;
      const y = Number(years.value);
      const r = Number(rate.value) / 100;
      const principal = p * (1 - d);
      const i = r / 12;
      const n = y * 12;
      const m = i === 0 ? principal / n : (principal * i) / (1 - Math.pow(1 + i, -n));
      out.textContent = money(Math.round(m / 100) * 100) + " / month";
      financed.textContent = money(Math.round(principal));
      upfront.textContent = money(Math.round(p * d));
      priceOut.textContent = shortPrice(p);
      downOut.textContent = Number(down.value) + "% (" + shortPrice(Math.round(p * d)) + ")";
      yearsOut.textContent = y + " years (" + n + " months)";
      if (rateOut) rateOut.textContent = Number(rate.value) + "%";
    };

    [price, down, years, rate].forEach((el) => el.addEventListener("input", update));
    update();
  }

  /* ---------- inventory ---------- */
  const FILTER_KEYS = ["q", "make", "city", "body", "fuel", "trans", "yearMin", "priceMin", "priceMax", "mileageMax"];
  const FILTER_LABELS = {
    q: "Keyword",
    make: "Make",
    city: "City",
    body: "Body",
    fuel: "Fuel",
    trans: "Transmission",
    yearMin: "Year from",
    priceMin: "Min price",
    priceMax: "Max price",
    mileageMax: "Max mileage"
  };

  function initInventory() {
    const grid = $("#car-grid");
    if (!grid) return;

    const params = new URLSearchParams(location.search);
    const state = {};
    FILTER_KEYS.forEach((k) => (state[k] = params.get(k) || ""));
    state.sort = params.get("sort") || "newest";

    const pageSize = 6;
    let page = 1;
    let results = [];

    const makeSel = $("#filter-make");
    const citySel = $("#filter-city");
    const bodySel = $("#filter-body");
    const fuelSel = $("#filter-fuel");
    const transSel = $("#filter-trans");
    const yearSel = $("#filter-year-min");
    const pminSel = $("#filter-price-min");
    const pmaxSel = $("#filter-price-max");
    const mileSel = $("#filter-mileage-max");
    const sortSel = $("#sort-select");
    const countEl = $("#results-count");
    const chipsEl = $("#active-chips");
    const moreBtn = $("#load-more");
    const searchInput = $("#filter-search");

    const uniq = (arr) => Array.from(new Set(arr)).sort();
    uniq(cars.map((c) => c.make)).forEach((m) => makeSel.insertAdjacentHTML("beforeend", `<option value="${esc(m)}">${esc(m)}</option>`));
    uniq(cars.map((c) => c.city)).forEach((c) => citySel.insertAdjacentHTML("beforeend", `<option value="${esc(c)}">${esc(c)}</option>`));
    uniq(cars.map((c) => c.body)).forEach((b) => bodySel.insertAdjacentHTML("beforeend", `<option value="${esc(b)}">${esc(b)}</option>`));
    uniq(cars.map((c) => c.fuel)).forEach((f) => fuelSel.insertAdjacentHTML("beforeend", `<option value="${esc(f)}">${esc(f)}</option>`));
    uniq(cars.map((c) => c.transmission)).forEach((t) => transSel.insertAdjacentHTML("beforeend", `<option value="${esc(t)}">${esc(t)}</option>`));
    uniq(cars.map((c) => c.year))
      .sort((a, b) => b - a)
      .forEach((y) => yearSel.insertAdjacentHTML("beforeend", `<option value="${y}">${y} or newer</option>`));

    const priceOptions = [
      [0, "Any"],
      [2000000, "Under 20 Lacs"],
      [3000000, "Under 30 Lacs"],
      [5000000, "Under 50 Lacs"],
      [8000000, "Under 80 Lacs"],
      [12000000, "Under 1.2 Crore"],
      [20000000, "Under 2 Crore"],
      [30000000, "Under 3 Crore"],
      [50000000, "Under 5 Crore"]
    ];
    priceOptions.forEach(([v, label]) => pminSel.insertAdjacentHTML("beforeend", `<option value="${v || ""}">${label}</option>`));
    priceOptions.forEach(([v, label]) => {
      if (v === 0) return;
      pmaxSel.insertAdjacentHTML("beforeend", `<option value="${v}">${label.replace("Under", "Up to")}</option>`);
    });
    [[20000, "Under 20,000 km"], [40000, "Under 40,000 km"], [60000, "Under 60,000 km"], [100000, "Under 100,000 km"]].forEach(([v, l]) =>
      mileSel.insertAdjacentHTML("beforeend", `<option value="${v}">${l}</option>`)
    );

    // pre-fill controls from URL
    if (state.q) searchInput.value = state.q;
    if (state.make) makeSel.value = state.make;
    if (state.city) citySel.value = state.city;
    if (state.body) bodySel.value = state.body;
    if (state.fuel) fuelSel.value = state.fuel;
    if (state.trans) transSel.value = state.trans;
    if (state.yearMin) yearSel.value = state.yearMin;
    if (state.priceMin) pminSel.value = state.priceMin;
    if (state.priceMax) pmaxSel.value = state.priceMax;
    if (state.mileageMax) mileSel.value = state.mileageMax;
    sortSel.value = state.sort;

    function readControls() {
      state.q = searchInput.value.trim();
      state.make = makeSel.value;
      state.city = citySel.value;
      state.body = bodySel.value;
      state.fuel = fuelSel.value;
      state.trans = transSel.value;
      state.yearMin = yearSel.value;
      state.priceMin = pminSel.value;
      state.priceMax = pmaxSel.value;
      state.mileageMax = mileSel.value;
      state.sort = sortSel.value;
    }

    function labelFor(key, value) {
      if (key === "q") return '"' + value + '"';
      if (key === "priceMin") return "Min " + shortPrice(Number(value));
      if (key === "priceMax") return "Max " + shortPrice(Number(value));
      if (key === "yearMin") return value + " or newer";
      if (key === "mileageMax") return "Under " + Number(value).toLocaleString("en-PK") + " km";
      return value;
    }

    function apply() {
      results = cars.filter((c) => {
        if (state.q) {
          const hay = [c.make, c.model, c.variant, c.city, c.body, c.year, c.color].join(" ").toLowerCase();
          if (!hay.includes(state.q.toLowerCase())) return false;
        }
        if (state.make && c.make !== state.make) return false;
        if (state.city && c.city !== state.city) return false;
        if (state.body && c.body !== state.body) return false;
        if (state.fuel && c.fuel !== state.fuel) return false;
        if (state.trans && c.transmission !== state.trans) return false;
        if (state.yearMin && c.year < Number(state.yearMin)) return false;
        if (state.priceMin && c.price < Number(state.priceMin)) return false;
        if (state.priceMax && c.price > Number(state.priceMax)) return false;
        if (state.mileageMax && c.mileage > Number(state.mileageMax)) return false;
        return true;
      });

      const s = state.sort;
      if (s === "price-asc") results.sort((a, b) => a.price - b.price);
      else if (s === "price-desc") results.sort((a, b) => b.price - a.price);
      else if (s === "mileage-asc") results.sort((a, b) => a.mileage - b.mileage);
      else results.sort((a, b) => b.year - a.year || a.price - b.price);

      page = 1;
      render();
    }

    function render() {
      const shown = results.slice(0, page * pageSize);
      grid.innerHTML = shown.length
        ? shown.map(carCard).join("")
        : `<div class="empty" style="grid-column:1/-1">
             <span class="empty__icon">${ICONS.search}</span>
             <h3 class="h3">No cars match your filters</h3>
             <p class="muted small">Try widening the price range, removing a filter, or searching a different city.</p>
             <button class="btn btn--ghost btn--sm" type="button" id="empty-reset">Clear all filters</button>
           </div>`;

      countEl.innerHTML = `Showing <b>${shown.length}</b> of <b>${results.length}</b> demo listings`;
      moreBtn.hidden = shown.length >= results.length;
      moreBtn.textContent = `Load more (${Math.min(pageSize, results.length - shown.length)} more)`;

      // chips
      const chips = FILTER_KEYS.filter((k) => state[k]);
      chipsEl.innerHTML =
        chips.map((k) => `<span class="chip">${FILTER_LABELS[k]}: ${esc(labelFor(k, state[k]))}<button type="button" data-clear="${k}" aria-label="Remove ${FILTER_LABELS[k]} filter">&times;</button></span>`).join("") +
        (chips.length ? `<button type="button" class="chip chip--clear" id="clear-chips">Clear all</button>` : "");

      // sync URL
      const p = new URLSearchParams();
      FILTER_KEYS.forEach((k) => state[k] && p.set(k, state[k]));
      if (state.sort !== "newest") p.set("sort", state.sort);
      try {
        history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p.toString() : ""));
      } catch (err) {
        /* file:// may block history updates — filters still work */
      }

      // reveal animation for new cards
      initReveal();

      $("#empty-reset")?.addEventListener("click", reset);
      $("#clear-chips")?.addEventListener("click", reset);
      $$("[data-clear]", chipsEl).forEach((btn) =>
        btn.addEventListener("click", () => {
          const key = btn.dataset.clear;
          state[key] = "";
          const map = { q: searchInput, make: makeSel, city: citySel, body: bodySel, fuel: fuelSel, trans: transSel, yearMin: yearSel, priceMin: pminSel, priceMax: pmaxSel, mileageMax: mileSel };
          if (map[key]) map[key].value = "";
          apply();
        })
      );
    }

    function reset() {
      FILTER_KEYS.forEach((k) => (state[k] = ""));
      searchInput.value = "";
      [makeSel, citySel, bodySel, fuelSel, transSel, yearSel, pminSel, pmaxSel, mileSel].forEach((el) => (el.value = ""));
      state.sort = "newest";
      sortSel.value = "newest";
      apply();
      toast("Filters cleared");
    }

    let debounce;
    searchInput.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        readControls();
        apply();
      }, 220);
    });
    [makeSel, citySel, bodySel, fuelSel, transSel, yearSel, pminSel, pmaxSel, mileSel, sortSel].forEach((el) =>
      el.addEventListener("change", () => {
        readControls();
        apply();
      })
    );

    moreBtn.addEventListener("click", () => {
      page += 1;
      render();
    });

    $("#reset-filters")?.addEventListener("click", reset);
    $("#filter-toggle")?.addEventListener("click", () => {
      const panel = $("#filters-panel");
      const open = panel.classList.toggle("is-open");
      $("#filter-toggle").setAttribute("aria-expanded", String(open));
    });

    readControls();
    apply();
  }

  /* ---------- vehicle details ---------- */
  function initCarPage() {
    const target = $("#car-detail");
    if (!target) return;

    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const car = cars.find((c) => c.id === id) || cars[0];
    if (!car) return;

    document.title = car.year + " " + car.make + " " + car.model + " for sale in " + car.city + " | AutoDrive PK";

    const set = (sel, value, isHTML) => {
      const el = $(sel);
      if (!el) return;
      if (isHTML) el.innerHTML = value;
      else el.textContent = value;
    };

    set("#crumb-car", car.year + " " + car.make + " " + car.model);
    set("#car-title", car.year + " " + car.make + " " + car.model);
    set("#car-variant", car.variant + " · " + car.body + " · " + car.color);
    set("#car-price", shortPrice(car.price));
    set("#car-price-full", money(car.price) + " · " + car.city);
    set("#car-emi", money(monthly(car.price)) + "/month");
    set("#car-score", car.score.toFixed(1) + " / 10");
    set("#car-badge", car.badge);
    set("#car-location", car.area + ", " + car.city);
    set("#car-owners", car.owners);
    set("#car-condition", car.condition);
    set("#car-registered", car.registered);
    set(
      "#car-meta",
      `${car.year} model <span class="dot"></span> ${Number(car.mileage).toLocaleString("en-PK")} km <span class="dot"></span> ${car.fuel} <span class="dot"></span> ${car.transmission}`,
      true
    );

    // gallery
    const gallery = car.gallery && car.gallery.length ? car.gallery : [car.image];
    const mainImg = $("#gallery-main-img");
    mainImg.src = gallery[0];
    mainImg.alt = car.year + " " + car.make + " " + car.model;
    set(
      "#gallery-thumbs",
      gallery
        .map(
          (src, i) => `
        <button class="gallery__thumb" type="button" data-src="${src}" aria-current="${i === 0}" aria-label="Photo ${i + 1}">
          <img src="${src}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        </button>`
        )
        .join(""),
      true
    );
    $$(".gallery__thumb").forEach((btn) =>
      btn.addEventListener("click", () => {
        mainImg.src = btn.dataset.src;
        $$(".gallery__thumb").forEach((b) => b.setAttribute("aria-current", String(b === btn)));
      })
    );

    // specs
    const specs = [
      ["Model year", car.year],
      ["Mileage", Number(car.mileage).toLocaleString("en-PK") + " km"],
      ["Fuel", car.fuel],
      ["Transmission", car.transmission],
      ["Body type", car.body],
      ["Registered in", car.registered],
      ["Exterior colour", car.color],
      ["Ownership", car.owners],
      ["Condition", car.condition]
    ];
    set("#car-specs", specs.map(([k, v]) => `<div class="spec-item"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join(""), true);

    // features
    set("#car-features", car.features.map((f) => `<li>${ICONS.check}<span>${esc(f)}</span></li>`).join(""), true);
    set("#car-description", car.description);

    // seller
    set("#seller-name", car.seller.name);
    set("#seller-type", car.seller.type + " · Member since " + car.seller.since);
    set("#seller-initial", car.seller.name.split(" ").map((w) => w[0]).slice(0, 2).join(""));
    set("#seller-deals", car.seller.deals + " closed deals");

    const waText = `Assalam o Alaikum, I am interested in the ${car.year} ${car.make} ${car.model} (${car.id}) listed on AutoDrive PK. Is it still available?`;
    $$("[data-wa]").forEach((a) => (a.href = waLink(waText)));
    $$("[data-call]").forEach((a) => (a.href = "tel:" + String(site.phone || "").replace(/\s/g, "")));

    // similar
    const similar = cars.filter((c) => c.id !== car.id && (c.body === car.body || c.make === car.make)).slice(0, 3);
    const simWrap = $("#similar-grid");
    if (simWrap) {
      simWrap.innerHTML = (similar.length ? similar : cars.filter((c) => c.id !== car.id).slice(0, 3)).map(carCard).join("");
    }

    // small side list
    const side = $("#side-list");
    if (side) side.innerHTML = cars.filter((c) => c.id !== car.id).slice(0, 3).map(carCardCompact).join("");

    initReveal();
  }

  /* ---------- sell form ---------- */
  function initSellForm() {
    const form = $("#sell-form");
    if (!form) return;

    const steps = $$(".form-step", form);
    const pills = $$(".step-pill");
    let current = 0;
    let photos = [];

    function showStep(i, skipScroll) {
      current = i;
      steps.forEach((s, idx) => s.classList.toggle("is-active", idx === i));
      pills.forEach((p, idx) => {
        p.classList.toggle("is-active", idx === i);
        p.classList.toggle("is-done", idx < i);
      });
      if (i === steps.length - 1) buildReview();
      if (skipScroll) return;
      const card = $(".form-card");
      const top = card.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: "smooth" });
    }

    function validateStep(i) {
      let ok = true;
      const fields = $$("[data-required]", steps[i]);
      fields.forEach((input) => {
        const wrap = input.closest(".field") || input.closest(".check-group");
        const valid = input.type === "checkbox" ? input.checked : String(input.value).trim() !== "";
        if (!valid) {
          ok = false;
          if (wrap) wrap.classList.add("is-invalid");
        } else if (wrap) {
          wrap.classList.remove("is-invalid");
        }
      });
      if (!ok) toast("Please complete the highlighted fields");
      return ok;
    }

    $$("[data-required]").forEach((input) =>
      input.addEventListener("input", () => {
        const wrap = input.closest(".field");
        if (wrap && String(input.value).trim() !== "") wrap.classList.remove("is-invalid");
      })
    );

    pills.forEach((pill, idx) =>
      pill.addEventListener("click", () => {
        if (idx < current) showStep(idx);
      })
    );

    $$("[data-next]", form).forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!validateStep(current)) return;
        if (current < steps.length - 1) showStep(current + 1);
      })
    );
    $$("[data-prev]", form).forEach((btn) =>
      btn.addEventListener("click", () => {
        if (current > 0) showStep(current - 1);
      })
    );

    // price -> lacs/crore preview
    const priceInput = $("#sell-price");
    const pricePreview = $("#price-preview");
    const syncPrice = () => {
      const v = Number(priceInput.value || 0);
      pricePreview.textContent = v > 0 ? shortPrice(v) + "  ·  " + money(v) : "Enter an amount to preview Lacs / Crore";
    };
    if (priceInput) {
      priceInput.addEventListener("input", syncPrice);
      syncPrice();
    }

    // photos
    const fileInput = $("#sell-photos");
    const previews = $("#photo-previews");
    const upload = $("#upload-box");
    const countEl = $("#photo-count");

    function renderPreviews() {
      previews.innerHTML = photos
        .map(
          (p, i) => `
        <div class="preview">
          <img src="${p}" alt="Upload preview ${i + 1}">
          <button class="preview__x" type="button" data-rm="${i}" aria-label="Remove photo">&times;</button>
        </div>`
        )
        .join("");
      countEl.textContent = photos.length + " / 12 photos";
      $$("[data-rm]", previews).forEach((b) =>
        b.addEventListener("click", () => {
          photos.splice(Number(b.dataset.rm), 1);
          renderPreviews();
        })
      );
    }

    function addFiles(files) {
      Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 12 - photos.length)
        .forEach((f) => photos.push(URL.createObjectURL(f)));
      renderPreviews();
    }

    if (fileInput) {
      fileInput.addEventListener("change", (e) => addFiles(e.target.files));
      ["dragenter", "dragover"].forEach((ev) =>
        upload.addEventListener(ev, (e) => {
          e.preventDefault();
          upload.classList.add("is-drag");
        })
      );
      ["dragleave", "drop"].forEach((ev) =>
        upload.addEventListener(ev, (e) => {
          e.preventDefault();
          upload.classList.remove("is-drag");
        })
      );
      upload.addEventListener("drop", (e) => {
        if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
      });
      renderPreviews();
    }

    // feature chips
    $$(".feature-pick").forEach((btn) =>
      btn.addEventListener("click", () => {
        const on = btn.getAttribute("aria-pressed") === "true";
        btn.setAttribute("aria-pressed", String(!on));
        btn.classList.toggle("is-on", !on);
      })
    );

    function buildReview() {      const val = (sel) => ($(sel) ? $(sel).value.trim() : "");
      const features = $$('.feature-pick[aria-pressed="true"]').map((b) => b.textContent.trim());
      const rows = [
        ["Vehicle", [val("#sell-year"), val("#sell-make"), val("#sell-model")].filter(Boolean).join(" ")],
        ["Variant", val("#sell-variant") || "—"],
        ["City", val("#sell-city") || "—"],
        ["Mileage", val("#sell-mileage") ? Number(val("#sell-mileage")).toLocaleString("en-PK") + " km" : "—"],
        ["Fuel / Transmission", [val("#sell-fuel"), val("#sell-trans")].filter(Boolean).join(" / ") || "—"],
        ["Asking price", val("#sell-price") ? shortPrice(Number(val("#sell-price"))) : "—"],
        ["Features selected", features.length ? features.join(", ") : "None"],
        ["Photos", photos.length + " uploaded"],
        ["Seller", val("#sell-name") || "—"],
        ["WhatsApp", val("#sell-phone") || "—"]
      ];
      $("#review-rows").innerHTML = rows.map(([k, v]) => `<div class="review-box__row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
    }

    ["#sell-name", "#sell-phone"].forEach((sel) => {
      const input = $(sel);
      if (input) input.addEventListener("input", () => {
        if (current === steps.length - 1) buildReview();
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (current !== steps.length - 1) return;
      if (!validateStep(current)) return;

      const payload = {
        createdAt: new Date().toISOString(),
        make: $("#sell-make").value.trim(),
        model: $("#sell-model").value.trim(),
        year: $("#sell-year").value,
        variant: $("#sell-variant").value.trim(),
        city: $("#sell-city").value,
        mileage: $("#sell-mileage").value,
        fuel: $("#sell-fuel").value,
        transmission: $("#sell-trans").value,
        price: Number($("#sell-price").value || 0),
        name: $("#sell-name").value.trim(),
        phone: $("#sell-phone").value.trim(),
        description: $("#sell-desc").value.trim(),
        features: $$('.feature-pick[aria-pressed="true"]').map((b) => b.textContent.trim()),
        photos: photos.length
      };

      try {
        const key = "autodrive_submissions";
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        existing.push(payload);
        localStorage.setItem(key, JSON.stringify(existing.slice(-20)));
      } catch (err) {
        /* storage may be blocked - submission is still demo-only */
      }

      form.hidden = true;
      $(".stepper").hidden = true;
      $("#sell-success").classList.add("is-visible");
      window.scrollTo({ top: $(".form-card").getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
      toast("Draft saved locally — backend needed to publish");
    });

    showStep(0, true);
  }

  /* ---------- small forms ---------- */
  function initMiniForms() {
    $$('form[data-demo-form]').forEach((f) =>
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const missing = $$("[required]", f).filter((el) => !String(el.value || "").trim());
        if (missing.length) {
          toast("Please fill in all required fields");
          missing[0].focus();
          return;
        }
        const email = f.querySelector('input[type="email"]');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
          toast("Please enter a valid email address");
          email.focus();
          return;
        }
        f.reset();
        toast(f.dataset.demoForm || "Thanks! We will get back to you soon.");
      })
    );

    $$('a[href^="#"]').forEach((a) => {
      const href = a.getAttribute("href");
      if (href.length > 1 && $(href)) {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          $(href).scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initReveal();
    initHome();
    initInventory();
    initCarPage();
    initSellForm();
    initMiniForms();
  });
})();
