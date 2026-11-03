/* ==========================================================================
   LaptopHub — cart store
   Persists to localStorage under `laptophub:cart:v1` and broadcasts a
   `cart:change` event so the header badge and cart page stay in sync.
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "laptophub:cart:v1";
  const FREE_SHIPPING_THRESHOLD = 200000;
  const SHIPPING_FEE = 2500;

  let items = load();

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (item) {
          return item && typeof item.id === "string" && typeof item.price === "number" && typeof item.quantity === "number";
        })
        .map(function (item) {
          const stock = Number.isFinite(item.stock) ? item.stock : 99;
          return Object.assign({}, item, {
            quantity: Math.max(1, Math.min(item.quantity, stock)),
            stock: stock,
          });
        });
    } catch (error) {
      return [];
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      /* Storage may be full or blocked — keep the in-memory cart. */
    }
  }

  function count() {
    return items.reduce(function (sum, item) { return sum + item.quantity; }, 0);
  }

  function subtotal() {
    return items.reduce(function (sum, item) { return sum + item.price * item.quantity; }, 0);
  }

  function shipping() {
    const value = subtotal();
    if (value === 0) return 0;
    return value >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  }

  function total() {
    return subtotal() + shipping();
  }

  function paintBadges() {
    const value = count();
    document.querySelectorAll("[data-cart-count]").forEach(function (badge) {
      badge.textContent = value > 99 ? "99+" : String(value);
      badge.hidden = value === 0;
    });
    document.querySelectorAll("[data-cart-link]").forEach(function (link) {
      link.setAttribute("aria-label", value ? "Shopping cart, " + value + " items" : "Shopping cart");
    });
  }

  function broadcast() {
    persist();
    paintBadges();
    document.dispatchEvent(new CustomEvent("cart:change", {
      detail: { count: count(), subtotal: subtotal(), shipping: shipping(), total: total() },
    }));
  }

  function add(product, quantity) {
    if (!product) return;
    const max = Number.isFinite(product.stock) ? product.stock : 99;
    if (max <= 0) {
      window.LH.toast(product.name + " is out of stock", "info");
      return;
    }
    const amount = Math.max(1, Math.min(Number(quantity) || 1, max));
    const existing = items.find(function (item) { return item.id === product.id; });

    if (existing) {
      existing.quantity = Math.min(existing.quantity + amount, max);
    } else {
      items.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        image: product.image || null,
        icon: product.icon || null,
        processor: product.processor || null,
        ram: product.ram || null,
        storage: product.storage || null,
        stock: max,
        quantity: amount,
      });
    }

    broadcast();
    window.LH.toast(product.name + " added to cart");
  }

  function updateQuantity(id, quantity) {
    items = items.map(function (item) {
      if (item.id !== id) return item;
      return Object.assign({}, item, {
        quantity: Math.max(1, Math.min(Number(quantity) || 1, item.stock || 99)),
      });
    });
    broadcast();
  }

  function remove(id) {
    items = items.filter(function (item) { return item.id !== id; });
    broadcast();
    window.LH.toast("Item removed from cart", "info");
  }

  function clear(options) {
    items = [];
    broadcast();
    if (!options || !options.silent) window.LH.toast("Cart cleared", "info");
  }

  window.LH.cart = {
    items: function () { return items.slice(); },
    count: count,
    subtotal: subtotal,
    shipping: shipping,
    total: total,
    add: add,
    updateQuantity: updateQuantity,
    remove: remove,
    clear: clear,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    shippingFee: SHIPPING_FEE,
  };

  document.addEventListener("DOMContentLoaded", function () {
    paintBadges();
    document.dispatchEvent(new CustomEvent("cart:change", {
      detail: { count: count(), subtotal: subtotal(), shipping: shipping(), total: total() },
    }));
  });
})();
