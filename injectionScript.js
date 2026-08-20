// Resident Evil Requiem — Character page
// Fetches /api/characters, builds the thumbnail switcher strip, and
// drives a peek-carousel (same visual style as the Locations section
// on the landing page) scoped to whichever character is active.

async function loadCharacters() {
  try {
    const response = await fetch("/api/characters");

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    initCharacterSection(data);
  } catch (error) {
    console.error("Error loading characters:", error);
  }
}

function initCharacterSection(characters) {
  if (!Array.isArray(characters) || !characters.length) return;

  const switcherTrack = document.querySelector("[data-character-track]");
  const switcherPrev = document.querySelector("[data-character-prev]");
  const switcherNext = document.querySelector("[data-character-next]");
  const imagesNav = document.querySelector("[data-character-images-nav]");
  const sliderRoot = document.querySelector("[data-character-slider]");
  const sliderTrack = document.querySelector("[data-character-slider-track]");
  const nameEl = document.querySelector("[data-character-name]");
  const bioEl = document.querySelector("[data-character-bio]");

  if (!switcherTrack || !sliderRoot || !sliderTrack) return;

  let activeCharacterIndex = 0;
  let activeImageIndex = 0;

  const currentCharacter = () => characters[activeCharacterIndex];
  const currentImages = () => currentCharacter().images || [];

  // --- Thumbnail switcher strip ---------------------------
  switcherTrack.innerHTML = "";
  characters.forEach((character, index) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "character-switcher__thumb";
    thumb.dataset.characterIndex = String(index);
    thumb.setAttribute("aria-label", character.name);

    const img = document.createElement("img");
    img.src = (character.images && character.images[0]) || "";
    img.alt = character.name;
    img.draggable = false;

    thumb.appendChild(img);
    thumb.addEventListener("click", () => setActiveCharacter(index));
    switcherTrack.appendChild(thumb);
  });

  const updateSwitcherHighlight = () => {
    switcherTrack
      .querySelectorAll("[data-character-index]")
      .forEach((thumb) => {
        thumb.classList.toggle(
          "is-active",
          Number(thumb.dataset.characterIndex) === activeCharacterIndex,
        );
      });
  };

  // --- Peek-carousel centering math ---------------
  const gapPx = () =>
    parseFloat(
      getComputedStyle(sliderTrack).columnGap ||
        getComputedStyle(sliderTrack).gap ||
        "0",
    );

  const offsetForImageIndex = (index) => {
    const slides = sliderTrack.querySelectorAll("[data-character-slide]");
    const slide = slides[index];
    if (!slide) return 0;

    const containerWidth = sliderRoot.getBoundingClientRect().width;
    const slideWidth = slide.getBoundingClientRect().width;
    const slideCenter = slide.offsetLeft + slideWidth / 2;

    return containerWidth / 2 - slideCenter;
  };

  // --- Rebuilds the slide markup -----------------------------------
  const renderCharacterImages = () => {
    const images = currentImages();
    const name = currentCharacter().name;

    sliderTrack.innerHTML = images
      .map(
        (src, i) => `
        <div class="location-slider__slide${i === 0 ? " is-active" : ""}" data-character-slide>
          <img src="${src}" alt="${name} — image ${i + 1}" draggable="false" />
        </div>`,
      )
      .join("");

    renderImageDots();

    // Snap to the first image instantly
    sliderTrack.style.transition = "none";
    requestAnimationFrame(() => {
      sliderTrack.style.transform = `translateX(${offsetForImageIndex(0)}px)`;
    });
  };

  // --- "Images 1 – 2 – 3 – 4 – 5" dot nav -------
  const renderImageDots = () => {
    if (!imagesNav) return;
    const images = currentImages();

    const dots = images
      .map(
        (_, i) => `
        <button
          type="button"
          class="media-slider__dot${i === activeImageIndex ? " is-active" : ""}"
          data-character-image-dot="${i}"
          aria-label="Afficher l'image ${i + 1}"
        >${i + 1}</button>`,
      )
      .join('<span class="media-slider__sep">–</span>');

    imagesNav.innerHTML = `<span class="media-slider__label">Images</span>${dots}`;

    imagesNav.querySelectorAll("[data-character-image-dot]").forEach((dot) => {
      dot.addEventListener("click", () => {
        goToImage(Number(dot.dataset.characterImageDot));
      });
    });
  };

  // --- Moves within the CURRENT character's images (dot click, arrow
  //     drag) — toggles existing slides rather than rebuilding them. ---
  const goToImage = (index, animate = true) => {
    const images = currentImages();
    if (!images.length) return;

    activeImageIndex = (index + images.length) % images.length;

    sliderTrack
      .querySelectorAll("[data-character-slide]")
      .forEach((slide, i) => {
        slide.classList.toggle("is-active", i === activeImageIndex);
      });

    imagesNav?.querySelectorAll("[data-character-image-dot]").forEach((dot) => {
      dot.classList.toggle(
        "is-active",
        Number(dot.dataset.characterImageDot) === activeImageIndex,
      );
    });

    sliderTrack.style.transition = animate ? "transform 0.6s ease" : "none";
    sliderTrack.style.transform = `translateX(${offsetForImageIndex(activeImageIndex)}px)`;
  };

  // --- Switches which character is shown: name, bio, thumbnail strip
  //     highlight, and rebuilds the image carousel for that character. -
  function setActiveCharacter(index) {
    activeCharacterIndex = (index + characters.length) % characters.length;
    activeImageIndex = 0;

    updateSwitcherHighlight();

    const character = currentCharacter();
    if (nameEl) nameEl.textContent = character.name;

    if (bioEl) {
      const paragraphs = Array.isArray(character.description)
        ? character.description
        : [character.description].filter(Boolean);

      bioEl.innerHTML = paragraphs
        .map((text) => `<p class="info-text info-text--highlight">${text}</p>`)
        .join("");
    }

    renderCharacterImages();
  }

  switcherPrev?.addEventListener("click", () =>
    setActiveCharacter(activeCharacterIndex - 1),
  );
  switcherNext?.addEventListener("click", () =>
    setActiveCharacter(activeCharacterIndex + 1),
  );

  // --- Drag / swipe on the big carousel — same pattern as the
  //     Locations peek-carousel on the landing page. -------------------
  let isDragging = false;
  let startX = 0;
  let baseOffset = 0;
  let latestDelta = 0;

  sliderTrack.addEventListener("pointerdown", (event) => {
    isDragging = true;
    startX = event.clientX;
    baseOffset = offsetForImageIndex(activeImageIndex);
    latestDelta = 0;
    sliderRoot.classList.add("is-dragging");
    sliderTrack.style.transition = "none";
    sliderTrack.setPointerCapture?.(event.pointerId);
  });

  sliderTrack.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    latestDelta = event.clientX - startX;
    sliderTrack.style.transform = `translateX(${baseOffset + latestDelta}px)`;
  });

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    sliderRoot.classList.remove("is-dragging");

    const slides = sliderTrack.querySelectorAll("[data-character-slide]");
    const slideWidth = slides[0]?.getBoundingClientRect().width || 1;
    const threshold = slideWidth * 0.18;

    if (latestDelta <= -threshold) {
      goToImage(activeImageIndex + 1);
    } else if (latestDelta >= threshold) {
      goToImage(activeImageIndex - 1);
    } else {
      goToImage(activeImageIndex); // snap back
    }
  };

  sliderTrack.addEventListener("pointerup", endDrag);
  sliderTrack.addEventListener("pointercancel", endDrag);
  sliderTrack.addEventListener("pointerleave", (event) => {
    if (isDragging && event.buttons === 0) endDrag();
  });

  window.addEventListener("resize", () => goToImage(activeImageIndex, false));

  // --- Go! ---------------------------------------------------------------
  setActiveCharacter(0);
}

loadCharacters();
