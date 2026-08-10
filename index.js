// Resident Evil Requiem — landing page interactions

document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.querySelector(".nav-menu");
  const navLinks = document.querySelectorAll(".nav-link");

  // --- Mobile menu open/close -------------------------------------------
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Close the menu after picking a link on mobile
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // --- Highlight the nav link for whichever section is on screen --------
  const sections = Array.from(navLinks)
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (sections.length) {
    const setActiveLink = (id) => {
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveLink(entry.target.id);
          }
        });
      },
      { rootMargin: "-50% 0px -50% 0px" } // trigger when a section crosses the middle of the viewport
    );

    sections.forEach((section) => observer.observe(section));
  }

  initFadeSliders();
  initCarousels();
  initTrailerSlider();
});

// --- Story-style slider: images crossfade, driven by numbered dots ------
function initFadeSliders() {
  document.querySelectorAll(".media-slider--fade[data-slider]").forEach((slider) => {
    const slides = slider.querySelectorAll("[data-slide]");
    const dots = slider.querySelectorAll("[data-slide-index]");
    if (!slides.length) return;

    let current = 0;
    let timer = null;

    const show = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle("is-active", i === current));
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === current));
    };

    const restartAutoplay = () => {
      clearInterval(timer);
      timer = setInterval(() => show(current + 1), 5000);
    };

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        show(Number(dot.dataset.slideIndex));
        restartAutoplay(); // manual pick resets the clock instead of jumping right after
      });
    });

    show(0);
    restartAutoplay();
  });
}

// --- Locations-style slider: track slides horizontally, prev/next arrows -
function initCarousels() {
  document.querySelectorAll(".media-slider--carousel[data-slider]").forEach((slider) => {
    const track = slider.querySelector("[data-slider-track]");
    const slides = slider.querySelectorAll("[data-slide]");
    const prevBtn = slider.querySelector("[data-slide-prev]");
    const nextBtn = slider.querySelector("[data-slide-next]");
    if (!track || !slides.length) return;

    let current = 0;
    let timer = null;

    const update = () => {
      track.style.transform = `translateX(-${current * 100}%)`;
    };

    const go = (direction) => {
      current = (current + direction + slides.length) % slides.length;
      update();
    };

    const restartAutoplay = () => {
      clearInterval(timer);
      timer = setInterval(() => go(1), 5000);
    };

    prevBtn?.addEventListener("click", () => {
      go(-1);
      restartAutoplay();
    });

    nextBtn?.addEventListener("click", () => {
      go(1);
      restartAutoplay();
    });

    update();
    restartAutoplay();
  });
}

// --- Trailer filmstrip: native horizontal scroll + snap, driven by
//     prev/next arrows, with a live "current / total" counter --------
function initTrailerSlider() {
  const track = document.querySelector("[data-trailer-track]");
  if (!track) return;

  const cards = track.querySelectorAll("[data-trailer-card]");
  const prevBtn = document.querySelector("[data-trailer-prev]");
  const nextBtn = document.querySelector("[data-trailer-next]");
  const currentEl = document.querySelector("[data-trailer-current]");
  const totalEl = document.querySelector("[data-trailer-total]");
  if (!cards.length) return;

  const pad = (n) => String(n).padStart(2, "0");

  if (totalEl) totalEl.textContent = pad(cards.length);

  const step = () => {
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "0");
    return cardWidth + gap;
  };

  const updateCounter = () => {
    if (!currentEl) return;
    const index = Math.round(track.scrollLeft / step());
    const clamped = Math.min(Math.max(index, 0), cards.length - 1);
    currentEl.textContent = pad(clamped + 1);
  };

  prevBtn?.addEventListener("click", () => {
    track.scrollBy({ left: -step(), behavior: "smooth" });
  });

  nextBtn?.addEventListener("click", () => {
    track.scrollBy({ left: step(), behavior: "smooth" });
  });

  let ticking = false;
  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      updateCounter();
      ticking = false;
    });
  });

  updateCounter();
}
