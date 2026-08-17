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
        link.classList.toggle(
          "is-active",
          link.getAttribute("href") === `#${id}`,
        );
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
      { rootMargin: "-50% 0px -50% 0px" }, // trigger when a section crosses the middle of the viewport
    );

    sections.forEach((section) => observer.observe(section));
  }

  initFadeSliders();
  initLocationSlider();
  initTrailerSlider();
  initCycleFade();
  initViewModeToggle();
});

// --- Story-style slider: images crossfade, driven by numbered dots ------
function initFadeSliders() {
  document
    .querySelectorAll(".media-slider--fade[data-slider]")
    .forEach((slider) => {
      const slides = slider.querySelectorAll("[data-slide]");
      const dots = slider.querySelectorAll("[data-slide-index]");
      if (!slides.length) return;

      let current = 0;
      let timer = null;

      const show = (index) => {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) =>
          slide.classList.toggle("is-active", i === current),
        );
        dots.forEach((dot, i) =>
          dot.classList.toggle("is-active", i === current),
        );
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

// --- Locations peek carousel

function initLocationSlider() {
  const root = document.querySelector("[data-location-slider]");
  if (!root) return;

  const track = root.querySelector("[data-slider-track]");
  const slides = track?.querySelectorAll("[data-slide]");
  const prevBtn = document.querySelector("[data-slide-prev]");
  const nextBtn = document.querySelector("[data-slide-next]");
  const progressBar = document.querySelector("[data-slide-progress]");
  if (!track || !slides.length) return;

  let current = 0;

  const gapPx = () =>
    parseFloat(
      getComputedStyle(track).columnGap || getComputedStyle(track).gap || "0",
    );

  // How far to shift the track so that slide `index` sits centered in
  // the viewport, regardless of the container's/slide's actual width.
  const offsetForIndex = (index) => {
    const containerWidth = root.getBoundingClientRect().width;
    const slide = slides[index];

    const slideCenter =
      slide.offsetLeft + slide.getBoundingClientRect().width / 2;

    const containerCenter = containerWidth / 2.069;
    return containerCenter - slideCenter;
  };

  const render = (animate = true) => {
    track.style.transition = animate ? "transform 0.6s ease" : "none";
    track.style.transform = `translateX(${offsetForIndex(current)}px)`;

    slides.forEach((slide, i) =>
      slide.classList.toggle("is-active", i === current),
    );

    if (progressBar) {
      progressBar.style.width = `${((current + 1) / slides.length) * 100}%`;
    }
  };

  const go = (direction) => {
    current = (current + direction + slides.length) % slides.length;
    render();
  };

  prevBtn?.addEventListener("click", () => go(-1));
  nextBtn?.addEventListener("click", () => go(1));

  // --- Drag / swipe: click-and-drag with a mouse, or touch on mobile ---
  let isDragging = false;
  let startX = 0;
  let baseOffset = 0;
  let latestDelta = 0;

  const onPointerDown = (event) => {
    isDragging = true;
    startX = event.clientX;
    baseOffset = offsetForIndex(current);
    latestDelta = 0;
    root.classList.add("is-dragging");
    track.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!isDragging) return;
    latestDelta = event.clientX - startX;
    track.style.transform = `translateX(${baseOffset + latestDelta}px)`;
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    root.classList.remove("is-dragging");

    const slideWidth = slides[0].getBoundingClientRect().width;
    const threshold = slideWidth * 0.18; // drag past ~18% of a slide's width to advance

    if (latestDelta <= -threshold) {
      go(1);
    } else if (latestDelta >= threshold) {
      go(-1);
    } else {
      render(); // snap back to the current slide
    }
  };

  track.addEventListener("pointerdown", onPointerDown);
  track.addEventListener("pointermove", onPointerMove);
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("pointerleave", (event) => {
    // only end the drag if the mouse button is no longer held
    if (isDragging && event.buttons === 0) endDrag();
  });

  // Re-center on resize — the pixel offset depends on the viewport width
  window.addEventListener("resize", () => render(false));

  render(false);
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
    const gap = parseFloat(
      getComputedStyle(track).columnGap || getComputedStyle(track).gap || "0",
    );
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

// --- Cycle-fade --------------------------------------------------
function initCycleFade() {
  document.querySelectorAll(".cycle-fade").forEach((container) => {
    const slides = container.querySelectorAll(".cycle-fade__img");
    if (slides.length < 2) return;

    let current = Math.max(
      0,
      Array.from(slides).findIndex((slide) =>
        slide.classList.contains("is-active"),
      ),
    );

    const next = () => {
      const upcoming = (current + 1) % slides.length;
      slides[current].classList.remove("is-active");
      slides[upcoming].classList.add("is-active");
      current = upcoming;
    };

    const startDelay = Math.random() * 2000;
    setTimeout(() => {
      next();
      setInterval(next, 4500);
    }, startDelay);
  });
}

// --- Modes de vue: clicking a character's name crossfades every
//     [data-viewmode-media] shot to that character's image at once. ---

function initViewModeToggle() {
  const toggle = document.querySelector("[data-viewmode-toggle]");
  if (!toggle) return;

  const buttons = toggle.querySelectorAll("[data-viewmode-character]");
  const mediaGroups = document.querySelectorAll("[data-viewmode-media]");
  if (!buttons.length || !mediaGroups.length) return;

  const setCharacter = (character) => {
    buttons.forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        btn.dataset.viewmodeCharacter === character,
      );
    });

    mediaGroups.forEach((media) => {
      media.querySelectorAll("[data-viewmode-character]").forEach((img) => {
        img.classList.toggle(
          "is-active",
          img.dataset.viewmodeCharacter === character,
        );
      });
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("is-active")) return;
      setCharacter(btn.dataset.viewmodeCharacter);
    });
  });
}

function smoothscroll() {
  const lenis = new Lenis({
    lerp: 0.08,
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      event.preventDefault();

      const target = anchor.getAttribute("href");

      lenis.scrollTo(target);
    });
  });
}

smoothscroll();
