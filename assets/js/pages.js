/* ==========================================================================
   LaptopHub — page renderers
   Each page declares <body data-page="...">. This file renders the dynamic
   parts (catalogue, PDP, cart, accessories) and wires the forms.
   ========================================================================== */

(function () {
  "use strict";

  const LH = window.LH;
  const D = LH.data;
  const icon = LH.icon;
  const esc = LH.escapeHtml;
  const money = LH.formatPKR;
  const page = document.body.dataset.page || "home";

  const CATEGORY_ICONS = {
    Gamepad2: "gamepad",
    Briefcase: "briefcase",
    GraduationCap: "graduation",
    Clapperboard: "clapperboard",
    Feather: "feather",
  };

  /* ----------------------------- Shared bits ---------------------------- */
  function productCard(product, index) {
    const discount = LH.discountPercent(product);
    const delay = Math.min(index || 0, 5) * 50;
    const stockNote = product.stock <= 5
      ? '<span class="stock-note stock-note--low">Only ' + product.stock + " left</span>"
      : '<span class="stock-note">In stock</span>';

    return (
      '<article class="product-card reveal" style="transition-delay:' + delay + 'ms">' +
        '<a class="product-card__media" href="product.html?id=' + encodeURIComponent(product.id) + '" aria-label="View ' + esc(product.brand + " " + product.name) + '">' +
          '<img src="' + esc(LH.assetPath(product.image)) + '" alt="' + esc(product.brand + " " + product.name) + ' laptop" loading="lazy" decoding="async">' +
          (product.badge ? '<span class="badge">' + icon("zap") + esc(product.badge) + "</span>" : "") +
          (discount ? '<span class="badge badge--discount">-' + discount + "%</span>" : "") +
          '<span class="badge badge--brand">' + esc(product.brand) + "</span>" +
        "</a>" +
        '<div class="product-card__body">' +
          '<div class="product-card__top">' +
            '<h3 class="product-card__name"><a href="product.html?id=' + encodeURIComponent(product.id) + '">' + esc(product.name) + "</a></h3>" +
            LH.stars(product.rating) +
          "</div>" +
          '<p class="product-card__cpu">' + esc(product.processor) + "</p>" +
          '<div class="product-card__chips">' +
            '<span class="chip">' + product.ram + "GB RAM</span>" +
            '<span class="chip">' + esc(product.storage) + "</span>" +
          "</div>" +
          '<div class="product-card__foot">' +
            '<div class="product-card__pricing">' +
              "<div>" +
                '<p class="price">' + money(product.price) + "</p>" +
                (product.oldPrice ? '<p class="price--old">' + money(product.oldPrice) + "</p>" : "") +
              "</div>" +
              stockNote +
            "</div>" +
            '<div class="product-card__actions">' +
              '<button type="button" class="btn btn--primary" data-add="' + esc(product.id) + '">' + icon("cart", "icon--sm") + "Add to Cart</button>" +
              '<a class="btn btn--ghost" href="product.html?id=' + encodeURIComponent(product.id) + '">Details' + icon("arrow-right", "icon--sm") + "</a>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function categoryCard(category, index) {
    const count = D.products.filter(function (product) { return product.category === category.slug; }).length;
    return (
      '<a class="category-card reveal" style="transition-delay:' + Math.min(index || 0, 5) * 60 + 'ms" href="products.html?category=' + encodeURIComponent(category.slug) + '">' +
        '<span class="category-card__icon">' + icon(CATEGORY_ICONS[category.icon] || "gamepad") + "</span>" +
        "<h3>" + esc(category.name) + "</h3>" +
        "<p>" + esc(category.blurb) + "</p>" +
        '<span class="category-card__foot">' + count + " " + (count === 1 ? "model" : "models") + icon("arrow-up-right", "icon--sm") + "</span>" +
      "</a>"
    );
  }

  /* -------------------------------- Home -------------------------------- */
  function initHome() {
    const categories = document.getElementById("categories-grid");
    if (categories) {
      categories.innerHTML = D.categories.map(categoryCard).join("");
    }

    const featured = document.getElementById("featured-grid");
    if (featured) {
      featured.innerHTML = D.products
        .filter(function (product) { return product.featured; })
        .slice(0, 8)
        .map(productCard)
        .join("");
    }

    LH.reveal();
  }

  /* ------------------------------ Catalogue ----------------------------- */
  const SORT_VALUES = ["featured", "price-asc", "price-desc", "rating", "discount"];

  function parseList(value) {
    if (!value) return [];
    return String(value).split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function initProducts() {
    const filtersBody = document.getElementById("filters-body");
    const grid = document.getElementById("catalog-grid");
    const resultBar = document.getElementById("result-bar");
    const searchInput = document.getElementById("catalog-search");
    const sortSelect = document.getElementById("sort");
    const filtersPanel = document.getElementById("filters-panel");
    const filtersToggle = document.getElementById("filters-toggle");
    const filterCount = document.getElementById("filter-count");

    if (!filtersBody || !grid || !resultBar) return;

    const params = new URLSearchParams(window.location.search);
    const rawSort = params.get("sort");

    const state = {
      q: params.get("q") || "",
      category: params.get("category") || "",
      brands: parseList(params.get("brands")),
      bands: parseList(params.get("bands")),
      rams: parseList(params.get("rams")).map(Number).filter(function (value) { return Number.isFinite(value); }),
      sort: SORT_VALUES.indexOf(rawSort) !== -1 ? rawSort : "featured",
    };

    if (searchInput) searchInput.value = state.q;
    if (sortSelect) sortSelect.value = state.sort;

    function activeChips() {
      const chips = [];
      if (state.q.trim()) {
        chips.push({ key: "q", label: "“" + state.q.trim() + "”", attr: 'data-remove-q' });
      }
      if (state.category) {
        const category = LH.categoryBySlug(state.category);
        chips.push({ key: "category", label: category ? category.short : state.category, attr: "data-remove-category" });
      }
      state.brands.forEach(function (brand) {
        chips.push({ key: "brand-" + brand, label: brand, attr: 'data-remove-brand="' + esc(brand) + '"' });
      });
      state.bands.forEach(function (bandId) {
        const band = D.priceBands.find(function (item) { return item.id === bandId; });
        chips.push({ key: "band-" + bandId, label: band ? band.label : bandId, attr: 'data-remove-band="' + esc(bandId) + '"' });
      });
      state.rams.forEach(function (ram) {
        chips.push({ key: "ram-" + ram, label: ram + "GB RAM", attr: 'data-remove-ram="' + ram + '"' });
      });
      return chips;
    }

    function hasFilters() {
      return activeChips().length > 0 || state.sort !== "featured";
    }

    function toggleValue(key, value) {
      const list = state[key];
      const exists = list.indexOf(value) !== -1;
      state[key] = exists ? list.filter(function (item) { return item !== value; }) : list.concat([value]);
    }

    function resetAll() {
      state.q = "";
      state.category = "";
      state.brands = [];
      state.bands = [];
      state.rams = [];
      state.sort = "featured";
      if (searchInput) searchInput.value = "";
      if (sortSelect) sortSelect.value = "featured";
      apply();
    }

    function renderFilters() {
      const filtered = hasFilters();

      let html = '<div class="filters__head"><b>Filters</b>' +
        (filtered ? '<button type="button" class="filters__clear" data-clear>Clear all</button>' : "") +
        "</div>";

      html += '<div class="filter-group"><h4>Category</h4>';
      html += '<button type="button" class="filter-btn' + (!state.category ? " is-active" : "") + '" data-category="">' +
        "<span>All categories</span><span>" + D.products.length + "</span></button>";
      D.categories.forEach(function (category) {
        const count = D.products.filter(function (product) { return product.category === category.slug; }).length;
        html += '<button type="button" class="filter-btn' + (state.category === category.slug ? " is-active" : "") + '" data-category="' + esc(category.slug) + '">' +
          "<span>" + esc(category.short) + "</span><span>" + count + "</span></button>";
      });
      html += "</div>";

      html += '<div class="filter-group"><h4>Brand</h4>';
      D.brands.forEach(function (brand) {
        const count = D.products.filter(function (product) { return product.brand === brand; }).length;
        const checked = state.brands.indexOf(brand) !== -1;
        html += '<label class="check"><input type="checkbox" data-brand="' + esc(brand) + '"' + (checked ? " checked" : "") + ">" +
          "<span>" + esc(brand) + "</span><span>" + count + "</span></label>";
      });
      html += "</div>";

      html += '<div class="filter-group"><h4>Price range</h4>';
      D.priceBands.forEach(function (band) {
        const checked = state.bands.indexOf(band.id) !== -1;
        html += '<label class="check"><input type="checkbox" data-band="' + esc(band.id) + '"' + (checked ? " checked" : "") + ">" +
          "<span>" + esc(band.label) + "</span></label>";
      });
      html += "</div>";

      html += '<div class="filter-group"><h4>Memory</h4><div class="ram-btns">';
      D.ramOptions.forEach(function (ram) {
        html += '<button type="button" class="ram-btn' + (state.rams.indexOf(ram) !== -1 ? " is-active" : "") + '" data-ram="' + ram + '" aria-pressed="' + (state.rams.indexOf(ram) !== -1) + '">' + ram + "GB</button>";
      });
      html += "</div></div>";

      html += '<button type="button" class="btn btn--ghost btn--block" data-clear' + (filtered ? "" : " disabled") + ">Reset all filters</button>";

      filtersBody.innerHTML = html;

      if (filterCount) {
        const chips = activeChips().length;
        filterCount.textContent = String(chips);
        filterCount.hidden = chips === 0;
      }
    }

    function results() {
      const keyword = state.q.trim().toLowerCase();

      const list = D.products.filter(function (product) {
        if (state.category && product.category !== state.category) return false;
        if (state.brands.length && state.brands.indexOf(product.brand) === -1) return false;
        if (state.rams.length && state.rams.indexOf(product.ram) === -1) return false;

        if (state.bands.length) {
          const inBand = state.bands.some(function (bandId) {
            const band = D.priceBands.find(function (item) { return item.id === bandId; });
            if (!band) return false;
            const max = band.max === null ? Infinity : band.max;
            return product.price >= band.min && product.price < max;
          });
          if (!inBand) return false;
        }

        if (keyword) {
          const haystack = [
            product.name,
            product.brand,
            product.processor,
            product.gpu,
            product.storage,
            product.display,
            product.category,
          ].join(" ").toLowerCase();
          if (haystack.indexOf(keyword) === -1) return false;
        }

        return true;
      });

      switch (state.sort) {
        case "price-asc":
          return list.sort(function (a, b) { return a.price - b.price; });
        case "price-desc":
          return list.sort(function (a, b) { return b.price - a.price; });
        case "rating":
          return list.sort(function (a, b) { return b.rating - a.rating; });
        case "discount":
          return list.sort(function (a, b) {
            return LH.discountPercent(b) - LH.discountPercent(a) || b.rating - a.rating;
          });
        default:
          return list.sort(function (a, b) {
            return Number(b.featured) - Number(a.featured) || b.rating - a.rating;
          });
      }
    }

    function renderResults() {
      const list = results();
      const chips = activeChips();

      let bar = '<p><b>' + list.length + "</b> " + (list.length === 1 ? "laptop" : "laptops") + " found</p>";
      chips.forEach(function (chip) {
        bar += '<button type="button" class="chip-remove" ' + chip.attr + ">" + esc(chip.label) + icon("x") + "</button>";
      });
      if (hasFilters()) {
        bar += '<button type="button" class="result-bar__clear" data-clear>Clear all</button>';
      }
      resultBar.innerHTML = bar;

      if (list.length) {
        grid.innerHTML = list.map(productCard).join("");
      } else {
        grid.innerHTML =
          '<div class="empty-state" style="grid-column:1/-1">' +
            '<span class="icon-tile">' + icon("sparkles", "icon--lg") + "</span>" +
            "<h3>No laptops match those filters</h3>" +
            "<p>Try widening your price range, removing a brand or searching for a different model.</p>" +
            '<button type="button" class="btn btn--primary" data-clear>Reset filters</button>' +
          "</div>";
      }

      LH.reveal();
    }

    function syncURL() {
      const next = new URLSearchParams();
      if (state.q.trim()) next.set("q", state.q.trim());
      if (state.category) next.set("category", state.category);
      if (state.brands.length) next.set("brands", state.brands.join(","));
      if (state.bands.length) next.set("bands", state.bands.join(","));
      if (state.rams.length) next.set("rams", state.rams.join(","));
      if (state.sort !== "featured") next.set("sort", state.sort);

      const query = next.toString();
      try {
        window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
      } catch (error) {
        /* file:// and some sandboxes block history updates — filters still work. */
      }
    }

    function apply() {
      renderFilters();
      renderResults();
      syncURL();
    }

    filtersBody.addEventListener("click", function (event) {
      const clear = event.target.closest("[data-clear]");
      if (clear) {
        resetAll();
        return;
      }

      const category = event.target.closest("[data-category]");
      if (category) {
        state.category = category.dataset.category;
        apply();
        return;
      }

      const ram = event.target.closest("[data-ram]");
      if (ram) {
        toggleValue("rams", Number(ram.dataset.ram));
        apply();
      }
    });

    filtersBody.addEventListener("change", function (event) {
      const brand = event.target.closest("[data-brand]");
      if (brand) {
        toggleValue("brands", brand.dataset.brand);
        apply();
        return;
      }

      const band = event.target.closest("[data-band]");
      if (band) {
        toggleValue("bands", band.dataset.band);
        apply();
      }
    });

    resultBar.addEventListener("click", function (event) {
      if (event.target.closest("[data-clear]")) {
        resetAll();
        return;
      }

      if (event.target.closest("[data-remove-q]")) {
        state.q = "";
        if (searchInput) searchInput.value = "";
        apply();
        return;
      }

      if (event.target.closest("[data-remove-category]")) {
        state.category = "";
        apply();
        return;
      }

      const brand = event.target.closest("[data-remove-brand]");
      if (brand) {
        toggleValue("brands", brand.dataset.removeBrand);
        apply();
        return;
      }

      const band = event.target.closest("[data-remove-band]");
      if (band) {
        toggleValue("bands", band.dataset.removeBand);
        apply();
        return;
      }

      const ram = event.target.closest("[data-remove-ram]");
      if (ram) {
        toggleValue("rams", Number(ram.dataset.removeRam));
        apply();
      }
    });

    grid.addEventListener("click", function (event) {
      if (event.target.closest("[data-clear]")) resetAll();
    });

    if (searchInput) {
      const debounced = LH.debounce(function (value) {
        state.q = value;
        apply();
      }, 280);
      searchInput.addEventListener("input", function (event) {
        debounced(event.target.value);
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", function (event) {
        state.sort = event.target.value;
        apply();
      });
    }

    if (filtersToggle) {
      filtersToggle.addEventListener("click", function () {
        if (!filtersPanel) return;
        const open = filtersPanel.classList.toggle("is-open");
        filtersToggle.setAttribute("aria-expanded", String(open));
      });
    }

    apply();
  }

  /* ------------------------------ Product page --------------------------- */
  function initProductPage() {
    const root = document.getElementById("pdp-root");
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const product = LH.productById(params.get("id"));

    if (!product) {
      root.innerHTML =
        '<div class="container" style="padding:56px 24px">' +
          '<div class="empty-state" style="margin:0">' +
            '<span class="icon-tile">' + icon("package", "icon--lg") + "</span>" +
            '<h1 class="h2" style="margin-top:16px">Laptop not found</h1>' +
            "<p>The model you are looking for is not in this demo catalogue. Browse the full range instead.</p>" +
            '<a class="btn btn--primary" href="products.html">Browse all laptops</a>' +
          "</div>" +
        "</div>";
      return;
    }

    const discount = LH.discountPercent(product);
    const inStock = product.stock > 0;

    const keySpecs = [
      { icon: "cpu", label: "Processor", value: product.processor },
      { icon: "memory", label: "Memory", value: product.ram + "GB RAM" },
      { icon: "hard-drive", label: "Storage", value: product.storage },
      { icon: "monitor", label: "Display", value: product.display },
      { icon: "battery", label: "Battery", value: product.battery },
      { icon: "weight", label: "Weight", value: product.weight },
    ];

    const specRows = [
      ["Processor", product.processor],
      ["Memory", product.ram + "GB RAM"],
      ["Storage", product.storage],
      ["Graphics", product.gpu],
      ["Display", product.display],
      ["Operating system", product.os],
      ["Battery life", product.battery],
      ["Weight", product.weight],
      ["Colour", product.color],
      ["Warranty", "1-year official warranty"],
    ];

    const related = D.products
      .filter(function (item) { return item.id !== product.id && item.category === product.category; })
      .concat(D.products.filter(function (item) { return item.id !== product.id && item.category !== product.category; }))
      .slice(0, 3);

    root.innerHTML =
      '<div class="container">' +
        '<nav class="breadcrumb" aria-label="Breadcrumb" style="padding-top:24px">' +
          '<a href="index.html">Home</a>' + icon("chevron-right") +
          '<a href="products.html">All laptops</a>' + icon("chevron-right") +
          '<a href="products.html?category=' + encodeURIComponent(product.category) + '">' + esc(product.category) + "</a>" + icon("chevron-right") +
          "<strong>" + esc(product.name) + "</strong>" +
        "</nav>" +

        '<div class="pdp">' +
          '<div class="pdp__gallery">' +
            '<div class="pdp__frame"><div class="pdp__photo">' +
              '<img src="' + esc(LH.assetPath(product.image)) + '" alt="' + esc(product.brand + " " + product.name) + '">' +
              (product.badge ? '<span class="badge">' + icon("zap") + esc(product.badge) + "</span>" : "") +
              (discount ? '<span class="badge badge--discount">Save ' + discount + "%</span>" : "") +
            "</div></div>" +

            '<div class="trust-strip">' +
              "<div>" + icon("shield") + "Genuine unit</div>" +
              "<div>" + icon("truck") + "Ships in 24h</div>" +
              "<div>" + icon("rotate") + "7-day returns</div>" +
            "</div>" +

            '<div class="spec-strip">' +
              keySpecs.map(function (spec) {
                return '<div>' + icon(spec.icon) + "<small>" + esc(spec.label) + "</small><b>" + esc(spec.value) + "</b></div>";
              }).join("") +
            "</div>" +
          "</div>" +

          '<div class="pdp__info">' +
            '<div class="pdp__tags">' +
              '<span class="pill-brand">' + esc(product.brand) + "</span>" +
              '<span class="chip" style="text-transform:capitalize">' + esc(product.category) + "</span>" +
              '<span class="pill-stock">' + (inStock ? "In stock · " + product.stock + " units" : "Out of stock") + "</span>" +
            "</div>" +

            "<h1>" + esc(product.brand + " " + product.name) + "</h1>" +

            '<div class="pdp__rating">' + LH.stars(product.rating, true) +
              "<span>(" + product.reviewCount + " verified reviews)</span>" +
            "</div>" +

            '<p class="pdp__desc">' + esc(product.description) + "</p>" +

            '<div class="buy-box">' +
              '<div class="buy-box__price">' +
                '<p class="price">' + money(product.price) + "</p>" +
                (product.oldPrice ? '<p class="price--old">' + money(product.oldPrice) + "</p>" : "") +
                (product.oldPrice ? '<span class="save-pill">You save ' + money(product.oldPrice - product.price) + "</span>" : "") +
              "</div>" +
              '<p class="buy-box__tax">Inclusive of all taxes · 0% installment plans available at checkout</p>' +

              '<div class="buy-box__row">' +
                '<div class="qty">' +
                  '<button type="button" data-qty="-1" aria-label="Decrease quantity">' + icon("minus") + "</button>" +
                  '<output data-qty-value aria-live="polite">1</output>' +
                  '<button type="button" data-qty="1" aria-label="Increase quantity">' + icon("plus") + "</button>" +
                "</div>" +
                '<button type="button" class="btn btn--primary" data-pdp-add' + (inStock ? "" : " disabled") + ">" + icon("cart") + "Add to Cart</button>" +
                '<button type="button" class="btn btn--dark" data-pdp-buy' + (inStock ? "" : " disabled") + ">Buy Now</button>" +
              "</div>" +

              '<ul class="buy-box__perks">' +
                "<li>" + icon("truck") + "Free delivery in Karachi &amp; Lahore · 2–3 days nationwide</li>" +
                "<li>" + icon("shield") + "Official 1-year warranty with local service support</li>" +
                "<li>" + icon("rotate") + "7-day return on unopened boxes — no restocking fee</li>" +
              "</ul>" +
            "</div>" +

            '<div class="highlights"><h2>Why this model</h2><ul>' +
              product.highlights.map(function (highlight) { return "<li>" + esc(highlight) + "</li>"; }).join("") +
            "</ul></div>" +
          "</div>" +
        "</div>" +

        '<section class="specs" aria-labelledby="specs-heading">' +
          '<h2 id="specs-heading">Full specifications</h2>' +
          '<dl class="specs__table">' +
            specRows.map(function (row) {
              return '<div class="specs__row"><dt>' + esc(row[0]) + "</dt><dd>" + esc(row[1]) + "</dd></div>";
            }).join("") +
          "</dl>" +
        "</section>" +

        '<section class="related" aria-labelledby="related-heading">' +
          '<div class="related__head">' +
            "<div>" +
              '<span class="eyebrow">Keep comparing</span>' +
              '<h2 id="related-heading">You may also like</h2>' +
            "</div>" +
            '<a class="link-arrow" href="products.html">View all laptops' + icon("arrow-right", "icon--sm") + "</a>" +
          "</div>" +
          '<div class="product-grid" style="margin-top:24px">' + related.map(productCard).join("") + "</div>" +
        "</section>" +
      "</div>";

    /* Quantity control */
    let quantity = 1;
    const output = root.querySelector("[data-qty-value]");
    const minus = root.querySelector('[data-qty="-1"]');
    const plus = root.querySelector('[data-qty="1"]');

    function paintQuantity() {
      if (output) output.textContent = String(quantity);
      if (minus) minus.disabled = quantity <= 1;
      if (plus) plus.disabled = quantity >= product.stock;
    }

    if (minus) {
      minus.addEventListener("click", function () {
        quantity = Math.max(1, quantity - 1);
        paintQuantity();
      });
    }

    if (plus) {
      plus.addEventListener("click", function () {
        quantity = Math.min(product.stock, quantity + 1);
        paintQuantity();
      });
    }

    const addButton = root.querySelector("[data-pdp-add]");
    if (addButton) {
      addButton.addEventListener("click", function () { LH.cart.add(product, quantity); });
    }

    const buyButton = root.querySelector("[data-pdp-buy]");
    if (buyButton) {
      buyButton.addEventListener("click", function () {
        LH.cart.add(product, quantity);
        window.location.href = "cart.html";
      });
    }

    paintQuantity();
    LH.reveal();
  }

  /* --------------------------------- Cart -------------------------------- */
  let order = null;

  function renderCartPage() {
    const root = document.getElementById("cart-root");
    if (!root) return;

    if (order) {
      root.innerHTML =
        '<div class="container" style="padding:56px 0">' +
          '<div class="success">' +
            '<span class="success__icon">' + icon("check-circle", "icon--lg") + "</span>" +
            "<h1>Order placed</h1>" +
            "<p>Thank you! Your demo order <strong>#" + esc(order.id) + "</strong> has been recorded. A confirmation would normally be emailed to you.</p>" +
            '<dl class="success__summary">' +
              "<div><dt>Items</dt><dd>" + order.items + "</dd></div>" +
              "<div><dt>Order total</dt><dd>" + money(order.total) + "</dd></div>" +
              "<div><dt>Delivery</dt><dd>2–3 working days</dd></div>" +
            "</dl>" +
            '<div class="success__actions">' +
              '<a class="btn btn--primary" href="products.html">Continue shopping</a>' +
              '<a class="btn btn--ghost" href="contact.html">Contact support</a>' +
            "</div>" +
          "</div>" +
        "</div>";
      return;
    }

    const items = LH.cart.items();

    if (!items.length) {
      root.innerHTML =
        '<div class="container" style="padding:56px 0">' +
          '<div class="empty-cart">' +
            '<span class="empty-cart__icon">' + icon("bag", "icon--lg") + "</span>" +
            "<h1>Your cart is empty</h1>" +
            "<p>Add a laptop to get started — or browse the collections to see what is in stock this week.</p>" +
            '<div class="empty-cart__actions">' +
              '<a class="btn btn--primary" href="products.html">Browse laptops</a>' +
              '<a class="btn btn--ghost" href="products.html?category=gaming">Gaming picks</a>' +
            "</div>" +
          "</div>" +
        "</div>";
      return;
    }

    const subtotal = LH.cart.subtotal();
    const shipping = LH.cart.shipping();
    const total = LH.cart.total();
    const count = LH.cart.count();
    const threshold = LH.cart.freeShippingThreshold;
    const remaining = Math.max(threshold - subtotal, 0);
    const progress = Math.min((subtotal / threshold) * 100, 100);

    const itemsHtml = items.map(function (item) {
      const href = item.image ? "product.html?id=" + encodeURIComponent(item.id) : "accessories.html";
      const meta = [item.processor, item.ram ? item.ram + "GB RAM" : null, item.storage]
        .filter(Boolean).map(esc).join(" · ");

      return (
        '<li class="cart-item">' +
          '<a class="cart-item__media" href="' + href + '" aria-label="View ' + esc(item.name) + '">' +
            (item.image
              ? '<img src="' + esc(LH.assetPath(item.image)) + '" alt="' + esc(item.name) + '" loading="lazy">'
              : icon(item.icon ? item.icon.toLowerCase() : "package")) +
          "</a>" +
          '<div class="cart-item__body">' +
            '<p class="cart-item__brand">' + esc(item.brand || "LaptopHub") + "</p>" +
            '<h2 class="cart-item__name"><a href="' + href + '">' + esc(item.name) + "</a></h2>" +
            (meta ? '<p class="cart-item__meta">' + meta + "</p>" : "") +
            '<p class="cart-item__unit">' + money(item.price) + " each</p>" +
          "</div>" +
          '<div class="cart-item__side">' +
            '<div class="qty">' +
              '<button type="button" data-cart-dec="' + esc(item.id) + '" aria-label="Decrease quantity of ' + esc(item.name) + '"' + (item.quantity <= 1 ? " disabled" : "") + ">" + icon("minus") + "</button>" +
              "<output>" + item.quantity + "</output>" +
              '<button type="button" data-cart-inc="' + esc(item.id) + '" aria-label="Increase quantity of ' + esc(item.name) + '"' + (item.quantity >= item.stock ? " disabled" : "") + ">" + icon("plus") + "</button>" +
            "</div>" +
            '<div class="cart-item__total">' +
              money(item.price * item.quantity) +
              '<button type="button" class="cart-item__remove" data-cart-remove="' + esc(item.id) + '">' + icon("trash") + "Remove</button>" +
            "</div>" +
          "</div>" +
        "</li>"
      );
    }).join("");

    root.innerHTML =
      '<div class="container">' +
        '<div class="cart-head">' +
          "<div>" +
            '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><strong>Cart</strong></nav>' +
            "<h1>Shopping Cart</h1>" +
            "<p>" + count + " " + (count === 1 ? "item" : "items") + " · prices include all applicable taxes</p>" +
          "</div>" +
          '<button type="button" class="link-danger" data-cart-clear>' + icon("trash") + "Clear cart</button>" +
        "</div>" +

        '<div class="cart-layout">' +
          '<ul class="cart-items">' + itemsHtml + "</ul>" +

          '<aside class="summary">' +
            "<h2>Order summary</h2>" +
            '<div class="free-ship">' +
              "<p>" + (remaining > 0
                ? "Add <strong>" + money(remaining) + "</strong> more for free delivery"
                : '<span class="is-free">Free delivery unlocked</span>') + "</p>" +
              '<div class="meter"><span style="width:' + progress + '%"></span></div>' +
            "</div>" +

            '<dl class="summary__rows">' +
              "<div><dt>Subtotal</dt><dd>" + money(subtotal) + "</dd></div>" +
              "<div><dt>Delivery</dt><dd" + (shipping === 0 ? ' class="is-free"' : "") + ">" + (shipping === 0 ? "Free" : money(shipping)) + "</dd></div>" +
              '<div class="summary__total"><dt>Total</dt><dd>' + money(total) + "</dd></div>" +
            "</dl>" +

            '<button type="button" class="btn btn--primary btn--block" data-checkout>' + icon("package-check") + "Proceed to Checkout</button>" +
            '<a class="summary__back" href="products.html">' + icon("arrow-left", "icon--sm") + "Continue shopping</a>" +

            '<ul class="summary__perks">' +
              "<li>" + icon("shield") + "Secure checkout · 1-year official warranty</li>" +
              "<li>" + icon("truck") + "Nationwide delivery in 2–3 working days</li>" +
            "</ul>" +
          "</aside>" +
        "</div>" +
      "</div>";
  }

  function initCart() {
    const root = document.getElementById("cart-root");
    if (!root) return;

    root.addEventListener("click", function (event) {
      const clear = event.target.closest("[data-cart-clear]");
      if (clear) {
        LH.cart.clear();
        return;
      }

      const remove = event.target.closest("[data-cart-remove]");
      if (remove) {
        LH.cart.remove(remove.dataset.cartRemove);
        return;
      }

      const inc = event.target.closest("[data-cart-inc]");
      if (inc) {
        const item = LH.cart.items().find(function (entry) { return entry.id === inc.dataset.cartInc; });
        if (item) LH.cart.updateQuantity(item.id, item.quantity + 1);
        return;
      }

      const dec = event.target.closest("[data-cart-dec]");
      if (dec) {
        const item = LH.cart.items().find(function (entry) { return entry.id === dec.dataset.cartDec; });
        if (item) LH.cart.updateQuantity(item.id, item.quantity - 1);
        return;
      }

      const checkout = event.target.closest("[data-checkout]");
      if (checkout) {
        order = {
          id: "LH-" + String(Date.now()).slice(-6),
          total: LH.cart.total(),
          items: LH.cart.count(),
        };
        LH.cart.clear({ silent: true });
        renderCartPage();
      }
    });

    document.addEventListener("cart:change", function () {
      if (!order) renderCartPage();
    });

    renderCartPage();
  }

  /* ------------------------------ Accessories ---------------------------- */
  function initAccessories() {
    const grid = document.getElementById("accessories-grid");
    if (!grid) return;

    grid.innerHTML = D.accessories.map(function (accessory, index) {
      const iconName = (accessory.icon || "package").toLowerCase();
      return (
        '<article class="acc-card reveal" style="transition-delay:' + Math.min(index, 6) * 50 + 'ms">' +
          '<div class="acc-card__visual">' + icon(iconName, "icon--lg") + '<span class="chip">In stock</span></div>' +
          '<p class="acc-card__brand">' + esc(accessory.brand) + "</p>" +
          "<h3>" + esc(accessory.name) + "</h3>" +
          "<p>" + esc(accessory.blurb) + "</p>" +
          '<div class="acc-card__foot">' +
            '<p class="price">' + money(accessory.price) + "</p>" +
            '<button type="button" class="btn btn--primary btn--sm" data-add="' + esc(accessory.id) + '" aria-label="Add ' + esc(accessory.name) + ' to cart">' + icon("plus", "icon--sm") + "Add</button>" +
          "</div>" +
        "</article>"
      );
    }).join("");

    LH.reveal();
  }

  /* ------------------------------- Newsletter ---------------------------- */
  function initNewsletter() {
    const form = document.getElementById("newsletter-form");
    if (!form) return;
    const input = document.getElementById("newsletter-email");
    const note = document.getElementById("newsletter-message");
    const fallback = "Join 8,000+ subscribers. We never share your address.";

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const value = (input.value || "").trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

      if (!valid) {
        note.className = "form-note is-error";
        note.textContent = "Please enter a valid email address.";
        input.focus();
        return;
      }

      note.className = "form-note is-success";
      note.innerHTML = icon("check-circle", "icon--sm") + "You're on the list. Watch your inbox for the next drop.";
      input.value = "";
    });

    input.addEventListener("input", function () {
      if (note.classList.contains("is-error") || note.classList.contains("is-success")) {
        note.className = "form-note";
        note.textContent = fallback;
      }
    });
  }

  /* -------------------------------- Contact ------------------------------ */
  function initContact() {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const wrapper = form.closest(".contact-form");

    function field(name) { return document.getElementById("contact-" + name); }
    function error(name) { return form.querySelector('[data-error-for="' + name + '"]'); }

    function setError(name, message) {
      const input = field(name);
      const node = error(name);
      if (input) {
        input.classList.toggle("field--invalid", Boolean(message));
        input.setAttribute("aria-invalid", String(Boolean(message)));
      }
      if (node) {
        node.textContent = message || "";
        node.hidden = !message;
      }
    }

    form.addEventListener("input", function (event) {
      if (event.target.id && event.target.id.indexOf("contact-") === 0) {
        setError(event.target.id.replace("contact-", ""), "");
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const name = field("name").value.trim();
      const email = field("email").value.trim();
      const phone = field("phone").value.trim();
      const message = field("message").value.trim();

      const errors = {};
      if (name.length < 2) errors.name = "Please enter your full name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Please enter a valid email address.";
      if (phone && !/^[+\d][\d\s-]{7,}$/.test(phone)) errors.phone = "Please enter a valid phone number.";
      if (message.length < 10) errors.message = "Please add a little more detail (at least 10 characters).";

      ["name", "email", "phone", "message"].forEach(function (key) {
        setError(key, errors[key] || "");
      });

      const first = Object.keys(errors)[0];
      if (first) {
        field(first).focus();
        return;
      }

      if (wrapper) {
        wrapper.innerHTML =
          '<div style="text-align:center;padding:16px 0">' +
            '<span class="success__icon">' + icon("check-circle", "icon--lg") + "</span>" +
            '<h2 style="margin-top:16px">Message received</h2>' +
            "<p style=\"margin-top:8px;color:#475569;font-size:13px;line-height:1.7\">Thanks, " + esc(name.split(" ")[0] || "there") + ". Our team replies within one business day — usually much faster during store hours.</p>" +
            '<button type="button" class="btn btn--ghost" data-contact-reset style="margin-top:22px">Send another message</button>' +
          "</div>";

        wrapper.querySelector("[data-contact-reset]").addEventListener("click", function () {
          window.location.reload();
        });
      }
    });
  }

  /* ----------------------------- Global wiring --------------------------- */
  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-add]");
    if (!button) return;
    const product = LH.productById(button.dataset.add) || LH.accessoryById(button.dataset.add);
    if (product) LH.cart.add(product, Number(button.dataset.qty) || 1);
  });

  initNewsletter();

  if (page === "home") initHome();
  if (page === "products") initProducts();
  if (page === "product") initProductPage();
  if (page === "cart") initCart();
  if (page === "accessories") initAccessories();
  if (page === "contact") initContact();

  LH.reveal();
})();
