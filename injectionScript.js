// Resident Evil Requiem — Character page
//
// Fetches /api/characters and drives every [data-character-section] on
// the page independently (currently: "confirmed" roster + "unconfirmed"
// potential-returning characters). Each section gets its own instance:
// a thumbnail switcher, a peek-carousel with ONE SLIDE PER CHARACTER
// (dragging/switching characters slides the carousel, revealing the
// next character peeking at the edge — like the Locations carousel),
// and INSIDE each character's slide, a stack of that character's own
// images that crossfade via the numbered dots — same pattern as the
// Story section, just nested one level deeper.

async function loadCharacters() {
  try {
    const response = await fetch("/api/characters");

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    const confirmed = data.filter((c) => c.isConfirmed !== false);
    const unconfirmed = data.filter((c) => c.isConfirmed === false);

    document.querySelectorAll("[data-character-section]").forEach((section) => {
      const characters =
        section.dataset.characterSection === "unconfirmed"
          ? unconfirmed
          : confirmed;

      if (characters.length) {
        initCharacterSection(section, characters);
      } else {
        section.style.display = "none"; // nothing to show for this group
      }
    });
  } catch (error) {
    console.error("Error loading characters:", error);
  }
}

function initCharacterSection(root, characters) {
  if (!characters.length) return;

  const switcherWrap = root.querySelector(".character-switcher");
  const switcherTrack = root.querySelector("[data-character-track]");
  const switcherPrev = root.querySelector("[data-character-prev]");
  const switcherNext = root.querySelector("[data-character-next]");
  const imagesNav = root.querySelector("[data-character-images-nav]");
  const sliderRoot = root.querySelector("[data-character-slider]");
  const sliderTrack = root.querySelector("[data-character-slider-track]");
  const nameEl = root.querySelector("[data-character-name]");
  const bioEl = root.querySelector("[data-character-bio]");

  if (!switcherTrack || !sliderRoot || !sliderTrack) return;

  let activeCharacterIndex = 0;

  // --- Thumbnail switcher strip (one per character) ---------------------
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

  // A switcher with just one character has nothing to switch between
  if (characters.length <= 1 && switcherWrap) {
    switcherWrap.style.display = "none";
  }

  // --- Build every character's slide up front — each one holds a
  //     stack of that character's own images (crossfade, no cropping
  //     via object-fit: contain so portrait/landscape mixes both fit) --
  sliderTrack.innerHTML = characters
    .map((character, ci) => {
      const images = character.images || [];
      const imgsHtml = images
        .map(
          (src, ii) => `
          <img
            class="cycle-fade__img${ii === 0 ? " is-active" : ""}"
            data-character-image-index="${ii}"
            src="${src}"
            alt="${character.name} — image ${ii + 1}"
            draggable="false"
          />`,
        )
        .join("");

      return `
        <div
          class="location-slider__slide character-slide${ci === 0 ? " is-active" : ""}"
          data-character-slide
          data-character-slide-index="${ci}"
        >
          <div class="character-slide__frame">${imgsHtml}</div>
        </div>`;
    })
    .join("");

  const slides = () => sliderTrack.querySelectorAll("[data-character-slide]");

  // --- Peek-carousel centering math, scoped to CHARACTER slides now
  //     (same approach as the Locations carousel) -----------------------
  const offsetForCharacterIndex = (index) => {
    const slideEls = slides();
    const slide = slideEls[index];
    if (!slide) return 0;

    const containerWidth = sliderRoot.getBoundingClientRect().width;
    const slideWidth = slide.getBoundingClientRect().width;
    const slideCenter = slide.offsetLeft + slideWidth / 2;

    return containerWidth / 2 - slideCenter;
  };

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

  // --- "Images 1 – 2 – 3 – 4 – 5" dots for the ACTIVE character's own
  //     image set — rebuilt per character since the count varies -------
  const renderImageDots = () => {
    if (!imagesNav) return;

    const images = characters[activeCharacterIndex].images || [];
    const activeSlide = slides()[activeCharacterIndex];
    const activeImg = activeSlide?.querySelector(".cycle-fade__img.is-active");
    const activeImageIndex = activeImg
      ? Number(activeImg.dataset.characterImageIndex)
      : 0;

    if (images.length <= 1) {
      imagesNav.innerHTML = "";
      return;
    }

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

    imagesNav
      .querySelectorAll("[data-character-image-dot]")
      .forEach((dot) => {
        dot.addEventListener("click", () => {
          goToImage(Number(dot.dataset.characterImageDot));
        });
      });
  };

  // --- Crossfades WITHIN the currently active character's slide only —
  //     no carousel movement, exactly like the Story section's dots. ---
  const goToImage = (index) => {
    const activeSlide = slides()[activeCharacterIndex];
    if (!activeSlide) return;

    const imgs = activeSlide.querySelectorAll(".cycle-fade__img");
    if (!imgs.length) return;

    const next = ((index % imgs.length) + imgs.length) % imgs.length;
    imgs.forEach((img, i) => img.classList.toggle("is-active", i === next));

    renderImageDots();
  };

  // --- Switches which character is centered: name, bio, thumbnail
  //     highlight, and slides the carousel to reveal it. ----------------
  const setActiveCharacter = (index, animate = true) => {
    activeCharacterIndex = (index + characters.length) % characters.length;
    updateSwitcherHighlight();

    const character = characters[activeCharacterIndex];
    if (nameEl) nameEl.textContent = character.name;

    if (bioEl) {
      const paragraphs = Array.isArray(character.description)
        ? character.description
        : [character.description].filter(Boolean);

      bioEl.innerHTML = paragraphs
        .map((text) => `<p class="info-text info-text--highlight">${text}</p>`)
        .join("");
    }

    slides().forEach((slide, i) => {
      slide.classList.toggle("is-active", i === activeCharacterIndex);
    });

    renderImageDots();

    sliderTrack.style.transition = animate ? "transform 0.6s ease" : "none";
    sliderTrack.style.transform = `translateX(${offsetForCharacterIndex(activeCharacterIndex)}px)`;
  };

  switcherPrev?.addEventListener("click", () =>
    setActiveCharacter(activeCharacterIndex - 1),
  );
  switcherNext?.addEventListener("click", () =>
    setActiveCharacter(activeCharacterIndex + 1),
  );

  // --- Drag / swipe on the big carousel — moves between CHARACTERS,
  //     not between a single character's images. -----------------------
  let isDragging = false;
  let startX = 0;
  let baseOffset = 0;
  let latestDelta = 0;

  sliderTrack.addEventListener("pointerdown", (event) => {
    isDragging = true;
    startX = event.clientX;
    baseOffset = offsetForCharacterIndex(activeCharacterIndex);
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

    const slideEls = slides();
    const slideWidth = slideEls[0]?.getBoundingClientRect().width || 1;
    const threshold = slideWidth * 0.18;

    if (latestDelta <= -threshold) {
      setActiveCharacter(activeCharacterIndex + 1);
    } else if (latestDelta >= threshold) {
      setActiveCharacter(activeCharacterIndex - 1);
    } else {
      setActiveCharacter(activeCharacterIndex); // snap back
    }
  };

  sliderTrack.addEventListener("pointerup", endDrag);
  sliderTrack.addEventListener("pointercancel", endDrag);
  sliderTrack.addEventListener("pointerleave", (event) => {
    if (isDragging && event.buttons === 0) endDrag();
  });

  window.addEventListener("resize", () =>
    setActiveCharacter(activeCharacterIndex, false),
  );

  // --- Go! ---------------------------------------------------------------
  setActiveCharacter(0, false);
}

loadCharacters();
