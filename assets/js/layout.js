/* ==========================================================================
   LaptopHub — shared layout
   Injects the announcement bar, header, mobile nav, search overlay and footer
   into every page so the markup lives in one place.
   ========================================================================== */

(function () {
  "use strict";

  const LH = window.LH;
  const icon = LH.icon;

  const NAV = [
    { key: "home", label: "Home", href: "index.html" },
    { key: "products", label: "All Laptops", href: "products.html" },
    { key: "gaming", label: "Gaming Laptops", href: "products.html?category=gaming" },
    { key: "business", label: "Business Laptops", href: "products.html?category=business" },
    { key: "accessories", label: "Accessories", href: "accessories.html" },
    { key: "about", label: "About Us", href: "about.html" },
    { key: "contact", label: "Contact", href: "contact.html" },
  ];

  const page = document.body.dataset.page || "home";
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category");

  function activeKey() {
    if (page === "home") return "home";
    if (page === "products") {
      if (category === "gaming") return "gaming";
      if (category === "business") return "business";
      return "products";
    }
    if (page === "accessories" || page === "about" || page === "contact") return page;
    return "";
  }

  const active = activeKey();

  function navLinks(className) {
    return NAV.map(function (link) {
      const current = link.key === active;
      return (
        '<a class="' + (className || "") + (current ? " is-active" : "") + '" href="' + link.href + '"' +
        (current ? ' aria-current="page"' : "") + ">" + link.label + "</a>"
      );
    }).join("");
  }

  function mobileLinks() {
    return NAV.map(function (link) {
      const current = link.key === active;
      return (
        '<a class="' + (current ? "is-active" : "") + '" href="' + link.href + '"' +
        (current ? ' aria-current="page"' : "") + ">" + link.label + icon("arrow-right", "icon--sm") + "</a>"
      );
    }).join("");
  }

  /* ------------------------------- Header ------------------------------- */
  const headerMount = document.getElementById("site-header");
  if (headerMount) {
    headerMount.innerHTML =
      '<div class="topbar">' +
        '<div class="container topbar__inner">' +
          '<p>' + icon("truck", "icon--sm") + '<span>Free nationwide delivery over PKR 2,00,000</span></p>' +
          '<div class="topbar__right">' +
            '<span>' + icon("shield", "icon--sm") + "1-year official warranty</span>" +
            '<a href="tel:+922111111222">' + icon("phone", "icon--sm") + "+92 21 111 112 222</a>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<header class="header">' +
        '<div class="container header__inner">' +
          '<a class="brand" href="index.html" aria-label="LaptopHub home">' +
            '<span class="brand__mark"><img src="assets/images/logo.png" alt="LaptopHub logo" width="44" height="44"></span>' +
            "<span>" +
              '<span class="brand__text">Laptop<span>Hub</span></span>' +
              '<span class="brand__sub">Premium laptop store</span>' +
            "</span>" +
          "</a>" +
          '<nav class="nav" aria-label="Main navigation">' + navLinks("") + "</nav>" +
          '<div class="header__actions">' +
            '<button type="button" class="icon-btn" data-search-open aria-label="Search laptops">' + icon("search") + "</button>" +
            '<a href="cart.html" class="icon-btn" data-cart-link aria-label="Shopping cart">' + icon("cart") +
              '<span class="cart-count" data-cart-count hidden>0</span>' +
            "</a>" +
            '<a href="products.html" class="btn btn--primary header__cta">Shop Now' + icon("arrow-right", "icon--sm") + "</a>" +
            '<button type="button" class="icon-btn menu-btn" data-menu-toggle aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">' + icon("menu") + "</button>" +
          "</div>" +
        "</div>" +
        '<div class="mobile-nav" id="mobile-menu">' +
          '<nav class="container mobile-nav__list" aria-label="Mobile navigation">' +
            mobileLinks() +
            '<a class="btn btn--primary" href="products.html">Shop Now' + icon("arrow-right", "icon--sm") + "</a>" +
          "</nav>" +
        "</div>" +
      "</header>" +
      '<div class="search-overlay" data-search-overlay hidden>' +
        '<div class="search-panel" role="dialog" aria-modal="true" aria-label="Search laptops">' +
          '<form class="search-panel__form" data-search-form>' +
            icon("search") +
            '<label class="sr-only" for="site-search">Search query</label>' +
            '<input id="site-search" type="search" name="q" data-search-input placeholder="Search by model, brand or spec — e.g. MacBook, RTX 4060" autocomplete="off">' +
            '<button type="submit" class="btn btn--primary btn--sm">Search</button>' +
            '<button type="button" class="search-panel__close" data-search-close aria-label="Close search">' + icon("x") + "</button>" +
          "</form>" +
          '<div class="search-suggest">' +
            "<p>Popular searches</p>" +
            '<div class="search-suggest__list">' +
              ["MacBook", "Gaming", "RTX 4060", "Under 3 lacs", "ThinkPad", "OLED"].map(function (term) {
                return '<button type="button" class="chip" data-search-term="' + LH.escapeHtml(term) + '">' + LH.escapeHtml(term) + "</button>";
              }).join("") +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>";
  }

  /* ------------------------------- Footer ------------------------------- */
  const footerMount = document.getElementById("site-footer");
  if (footerMount) {
    const year = new Date().getFullYear();
    footerMount.innerHTML =
      '<footer class="footer">' +
        '<div class="container footer__main">' +
          "<div>" +
            '<a class="brand" href="index.html" aria-label="LaptopHub home">' +
              '<span class="brand__mark"><img src="assets/images/logo.png" alt="LaptopHub logo" width="44" height="44"></span>' +
              '<span class="brand__text">Laptop<span>Hub</span></span>' +
            "</a>" +
            '<p class="footer__about">Pakistan\'s premium laptop destination. Genuine stock, official warranties and expert advice for gamers, businesses and creators — from Karachi to Islamabad.</p>' +
            '<div class="socials">' +
              ["facebook", "instagram", "youtube", "linkedin"].map(function (name) {
                return '<a href="#" aria-label="' + name.charAt(0).toUpperCase() + name.slice(1) + '">' + icon(name) + "</a>";
              }).join("") +
            "</div>" +
          "</div>" +
          "<div>" +
            "<h3>Quick links</h3>" +
            '<ul class="footer__links">' +
              '<li><a href="products.html">All laptops</a></li>' +
              '<li><a href="products.html?category=gaming">Gaming laptops</a></li>' +
              '<li><a href="products.html?category=business">Business laptops</a></li>' +
              '<li><a href="accessories.html">Accessories</a></li>' +
              '<li><a href="about.html">About us</a></li>' +
              '<li><a href="contact.html">Contact</a></li>' +
            "</ul>" +
          "</div>" +
          "<div>" +
            "<h3>Customer support</h3>" +
            '<ul class="footer__links">' +
              '<li><a href="contact.html">Track your order</a></li>' +
              '<li><a href="about.html#shipping">Shipping &amp; delivery</a></li>' +
              '<li><a href="about.html#warranty">Returns &amp; warranty</a></li>' +
              '<li><a href="contact.html">Bulk &amp; corporate orders</a></li>' +
              '<li><a href="about.html#faq">FAQs</a></li>' +
              '<li><a href="about.html#privacy">Privacy policy</a></li>' +
            "</ul>" +
          "</div>" +
          "<div>" +
            "<h3>Get in touch</h3>" +
            '<ul class="footer__contact">' +
              "<li>" + icon("map-pin") + "<span>Shop 24, Tech Avenue,<br>Clifton Block 5, Karachi</span></li>" +
              '<li>' + icon("phone") + '<a href="tel:+922111111222">+92 21 111 112 222</a></li>' +
              '<li>' + icon("mail") + '<a href="mailto:hello@laptophub.pk">hello@laptophub.pk</a></li>' +
            "</ul>" +
            '<div class="pay-badges">' +
              ["Visa", "Mastercard", "Easypaisa", "JazzCash", "COD"].map(function (method) {
                return "<span>" + method + "</span>";
              }).join("") +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="container footer__bottom">' +
          "<p>© " + year + " LaptopHub. All rights reserved.</p>" +
          "<p>Demo storefront — product data and prices are sample content for presentation.</p>" +
        "</div>" +
      "</footer>";
  }

  /* --------------------------- Interactions ----------------------------- */
  const menuButton = document.querySelector("[data-menu-toggle]");
  const mobileNav = document.getElementById("mobile-menu");
  const searchOverlay = document.querySelector("[data-search-overlay]");
  const searchInput = document.querySelector("[data-search-input]");

  function lockBody() {
    const locked = (mobileNav && mobileNav.classList.contains("is-open")) ||
      (searchOverlay && !searchOverlay.hidden);
    document.body.classList.toggle("is-locked", Boolean(locked));
  }

  function setMenu(open) {
    if (!menuButton || !mobileNav) return;
    mobileNav.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menuButton.innerHTML = icon(open ? "x" : "menu");
    lockBody();
  }

  function setSearch(open) {
    if (!searchOverlay) return;
    searchOverlay.hidden = !open;
    if (open) {
      setMenu(false);
      window.setTimeout(function () { if (searchInput) searchInput.focus(); }, 60);
    }
    lockBody();
  }

  if (menuButton) {
    menuButton.addEventListener("click", function () {
      setMenu(!mobileNav.classList.contains("is-open"));
    });
  }

  document.querySelectorAll("[data-search-open]").forEach(function (button) {
    button.addEventListener("click", function () { setSearch(true); });
  });

  document.querySelectorAll("[data-search-close]").forEach(function (button) {
    button.addEventListener("click", function () { setSearch(false); });
  });

  if (searchOverlay) {
    searchOverlay.addEventListener("mousedown", function (event) {
      if (event.target === searchOverlay) setSearch(false);
    });
  }

  const searchForm = document.querySelector("[data-search-form]");
  if (searchForm) {
    searchForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const value = (searchInput && searchInput.value ? searchInput.value : "").trim();
      window.location.href = value ? "products.html?q=" + encodeURIComponent(value) : "products.html";
    });
  }

  document.querySelectorAll("[data-search-term]").forEach(function (button) {
    button.addEventListener("click", function () {
      window.location.href = "products.html?q=" + encodeURIComponent(button.dataset.searchTerm);
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setSearch(false);
      setMenu(false);
    }
  });

  lockBody();

  /* Cart badge is painted by cart.js; re-paint after the header exists. */
  if (window.LH.cart) {
    const total = window.LH.cart.count();
    document.querySelectorAll("[data-cart-count]").forEach(function (badge) {
      badge.textContent = total > 99 ? "99+" : String(total);
      badge.hidden = total === 0;
    });
  }
})();
