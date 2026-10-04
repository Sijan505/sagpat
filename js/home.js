// Home page: categories, featured slider, testimonials.

document.getElementById("category-grid").innerHTML = CATEGORIES.map((c) => `
  <a class="cat-card" href="products.html?cat=${c.id}">
    <img src="${c.image}" alt="" loading="lazy">
    <span class="label"><strong>${c.ne}</strong><span>${c.en}</span></span>
  </a>`).join("");

document.getElementById("testimonials").innerHTML = TESTIMONIALS.map((t) => `
  <figure class="testimonial">
    ${stars(t.rating, "Rating")}
    <blockquote>${escapeHtml(t.text)}</blockquote>
    <figcaption><strong>${escapeHtml(t.name)}</strong> <span>· ${escapeHtml(t.place)}</span></figcaption>
  </figure>`).join("");

(function initSlider() {
  const slider = document.getElementById("featured-slider");
  const viewport = slider.querySelector(".slider-viewport");
  const track = slider.querySelector(".slider-track");
  const dotsEl = slider.querySelector(".slider-dots");

  const top = PRODUCTS.filter((p) => p.stock > 0).sort((a, b) => b.sold - a.sold).slice(0, 8);
  track.innerHTML = top.map(productCard).join("");
  track.querySelectorAll("[data-add]").forEach((b) => (b.textContent = "Quick add"));

  let index = 0;
  let timer;
  const gap = () => parseFloat(getComputedStyle(track).gap) || 0;
  const step = () => track.children[0].getBoundingClientRect().width + gap();
  const visible = () => Math.max(1, Math.round((viewport.clientWidth + gap()) / step()));
  const maxIndex = () => Math.max(0, top.length - visible());

  function renderDots() {
    dotsEl.innerHTML = Array.from({ length: maxIndex() + 1 }, (_, i) =>
      `<button type="button" aria-label="Slide ${i + 1}" data-i="${i}"></button>`).join("");
  }

  function go(i) {
    const max = maxIndex();
    index = i > max ? 0 : i < 0 ? max : i;
    track.style.transform = `translateX(-${index * step()}px)`;
    dotsEl.querySelectorAll("button").forEach((d, n) => d.setAttribute("aria-current", n === index));
  }

  const play = () => {
    clearInterval(timer);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) timer = setInterval(() => go(index + 1), 4000);
  };
  const pause = () => clearInterval(timer);

  document.querySelector(".slider-btn.prev").addEventListener("click", () => { go(index - 1); play(); });
  document.querySelector(".slider-btn.next").addEventListener("click", () => { go(index + 1); play(); });
  dotsEl.addEventListener("click", (e) => {
    if (e.target.dataset.i) { go(Number(e.target.dataset.i)); play(); }
  });
  slider.addEventListener("mouseenter", pause);
  slider.addEventListener("mouseleave", play);
  slider.addEventListener("focusin", pause);
  slider.addEventListener("focusout", play);

  let startX = null;
  slider.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; pause(); }, { passive: true });
  slider.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    startX = null;
    play();
  });

  window.addEventListener("resize", () => { renderDots(); go(Math.min(index, maxIndex())); });

  renderDots();
  go(0);
  play();
})();
