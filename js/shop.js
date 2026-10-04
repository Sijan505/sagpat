// Products page: sidebar filters, search and sort.

const PRICE_MIN = 50;
const PRICE_MAX = 1000;

const params = new URLSearchParams(location.search);
const state = {
  q: params.get("q") || "",
  cats: new Set(params.getAll("cat").filter(getCategory)),
  min: PRICE_MIN,
  max: PRICE_MAX,
  fresh: 0,
  inStock: false,
  wishlistOnly: params.get("wishlist") === "1",
  sort: "popular",
};

const els = {
  grid: document.getElementById("product-grid"),
  count: document.getElementById("result-count"),
  cats: document.getElementById("cat-filters"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  min: document.getElementById("price-min"),
  max: document.getElementById("price-max"),
  minLabel: document.getElementById("price-min-label"),
  maxLabel: document.getElementById("price-max-label"),
  fill: document.getElementById("range-fill"),
  inStock: document.getElementById("in-stock"),
  wishlist: document.getElementById("wishlist-only"),
  filters: document.getElementById("filters"),
  toggle: document.getElementById("filter-toggle"),
};

// ---------- Build controls ----------
els.cats.innerHTML = CATEGORIES.map((c) => `
  <label class="check">
    <input type="checkbox" value="${c.id}" ${state.cats.has(c.id) ? "checked" : ""}>
    <span>${c.en} <span class="ne muted">${c.ne}</span></span>
    <span class="count">${PRODUCTS.filter((p) => p.cat === c.id).length}</span>
  </label>`).join("");

els.search.value = state.q;
els.wishlist.checked = state.wishlistOnly;

// ---------- Filtering ----------
function matches(p) {
  const q = state.q.trim().toLowerCase();
  if (q) {
    const cat = getCategory(p.cat);
    const haystack = `${p.ne} ${p.en} ${cat.ne} ${cat.en} ${p.origin}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (state.cats.size && !state.cats.has(p.cat)) return false;
  if (p.price < state.min || p.price > state.max) return false;
  if (p.rating < state.fresh) return false;
  if (state.inStock && p.stock === 0) return false;
  if (state.wishlistOnly && !Wishlist.has(p.id)) return false;
  return true;
}

const SORTS = {
  popular: (a, b) => b.sold - a.sold,
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  fresh: (a, b) => b.rating - a.rating,
  new: (a, b) => new Date(b.added) - new Date(a.added),
};

function render() {
  const list = PRODUCTS.filter(matches).sort(SORTS[state.sort]);
  // Out-of-stock items always sink to the bottom
  list.sort((a, b) => (a.stock === 0) - (b.stock === 0));

  els.count.textContent = `${list.length} of ${PRODUCTS.length} products`;
  els.grid.innerHTML = list.length
    ? list.map(productCard).join("")
    : `<div class="panel empty-state" style="grid-column: 1 / -1;">
        <span class="ne">केही भेटिएन</span>
        <h2>Nothing matches those filters</h2>
        <p>Try another word, or clear the filters to see everything.</p>
        <button type="button" class="btn btn-outline" data-clear>Clear filters</button>
      </div>`;
}

function updateRange() {
  let min = Number(els.min.value);
  let max = Number(els.max.value);
  if (min > max) {
    // Whichever handle moved pushes the other one along
    if (document.activeElement === els.min) max = min;
    else min = max;
    els.min.value = min;
    els.max.value = max;
  }
  state.min = min;
  state.max = max;
  // Keep the min handle grabbable when both handles sit at the top end
  els.min.style.zIndex = min > PRICE_MAX - 100 ? 2 : "";
  els.minLabel.textContent = npr(min);
  els.maxLabel.textContent = npr(max);
  const span = PRICE_MAX - PRICE_MIN;
  els.fill.style.left = `${((min - PRICE_MIN) / span) * 100}%`;
  els.fill.style.right = `${100 - ((max - PRICE_MIN) / span) * 100}%`;
}

function clearFilters() {
  state.q = "";
  state.cats.clear();
  state.fresh = 0;
  state.inStock = false;
  state.wishlistOnly = false;
  els.search.value = "";
  els.cats.querySelectorAll("input").forEach((i) => (i.checked = false));
  document.querySelector('input[name="fresh"][value="0"]').checked = true;
  els.inStock.checked = false;
  els.wishlist.checked = false;
  els.min.value = PRICE_MIN;
  els.max.value = PRICE_MAX;
  updateRange();
  history.replaceState(null, "", location.pathname);
  render();
}

// ---------- Events ----------
let searchTimer;
els.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = els.search.value; render(); }, 150);
});
els.cats.addEventListener("change", (e) => {
  e.target.checked ? state.cats.add(e.target.value) : state.cats.delete(e.target.value);
  render();
});
[els.min, els.max].forEach((input) => input.addEventListener("input", () => { updateRange(); render(); }));
document.querySelectorAll('input[name="fresh"]').forEach((r) =>
  r.addEventListener("change", () => { state.fresh = Number(r.value); render(); }));
els.inStock.addEventListener("change", () => { state.inStock = els.inStock.checked; render(); });
els.wishlist.addEventListener("change", () => { state.wishlistOnly = els.wishlist.checked; render(); });
els.sort.addEventListener("change", () => { state.sort = els.sort.value; render(); });
document.getElementById("clear-filters").addEventListener("click", clearFilters);
els.grid.addEventListener("click", (e) => { if (e.target.closest("[data-clear]")) clearFilters(); });
els.toggle.addEventListener("click", () => {
  const open = els.filters.classList.toggle("open");
  els.toggle.setAttribute("aria-expanded", open);
});
// Re-filter when a heart is toggled while "Wishlist only" is on
document.addEventListener("wishlist:change", () => { if (state.wishlistOnly) render(); });

updateRange();
render();
