// Resident Evil Requiem — Character page
//
// Fetches /api/characters and drives every character-driven section on
// the page independently:
//   - [data-character-section] ("confirmed" roster + "unconfirmed"
//     potential-returning characters) — thumbnail switcher + peek
//     carousel with one slide per character, each holding a stack of
//     that character's own images crossfading via numbered dots.
//   - [data-model-viewer-section] — same thumbnail-switcher pattern,
//     but swaps a single <video>'s source instead of driving an image
//     carousel. Only characters with a non-empty model_video appear
//     in its switcher.

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

    const withModelVideo = data.filter((c) => c.model_video);

    document
      .querySelectorAll("[data-model-viewer-section]")
      .forEach((section) => {
        if (withModelVideo.length) {
          initModelViewerSection(section, withModelVideo);
        } else {
          section.style.display = "none"; // no videos added to characters.json yet
        }
      });
  } catch (error) {
    console.error("Error loading characters:", error);
  }
}

// --- Shared thumbnail switcher builder — used by both the character
//     carousel and the model viewer. Builds one thumbnail button per
//     character and wires clicks to onSelect(index); returns a
//     function to call whenever the active index changes so the
//     highlighted thumbnail can be kept in sync. ------------------------
function buildThumbnailSwitcher(root, characters, onSelect) {
  const wrap = root.querySelector(".character-switcher");
  const track = root.querySelector(
    "[data-character-track], [data-model-viewer-track]",
  );
  if (!track) return { updateHighlight: () => {} };

  track.innerHTML = "";
  characters.forEach((character, index) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "character-switcher__thumb";
    thumb.dataset.characterIndex = String(index);
    thumb.setAttribute("aria-label", character.name);

    const img = document.createElement("img");
    img.src =
      character.thumbnail_image ||
      (character.images && character.images[0]) ||
      "";
    img.alt = character.name;
    img.draggable = false;

    thumb.appendChild(img);
    thumb.addEventListener("click", () => onSelect(index));
    track.appendChild(thumb);
  });

  if (characters.length <= 1 && wrap) {
    wrap.style.display = "none";
  }

  return {
    updateHighlight: (activeIndex) => {
      track.querySelectorAll("[data-character-index]").forEach((thumb) => {
        thumb.classList.toggle(
          "is-active",
          Number(thumb.dataset.characterIndex) === activeIndex,
        );
      });
    },
  };
}

// --- Renders age/pob/nationality/affiliation/job/family/bloodType as
//     highlighted lines for the "Character information" sidebar. -------
function renderCharacterSpecs(character) {
  const formatValue = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean).join(", ");
    return value || "N/A";
  };

  const SPEC_FIELDS = [
    ["Âge", "age"],
    ["Lieu de naissance", "pob"],
    ["Nationalité", "nationality"],
    ["Affiliation", "affiliation"],
    ["Profession", "job"],
    ["Famille", "family"],
    ["Groupe sanguin", "bloodType"],
  ];

  return SPEC_FIELDS.map(
    ([label, key]) =>
      `<p class="info-text info-text--highlight"><strong>${label} :</strong> ${formatValue(character[key])}</p>`,
  ).join("");
}

function renderCharacterDescription(character) {
  const paragraphs = Array.isArray(character.description)
    ? character.description
    : [character.description].filter(Boolean);

  return paragraphs
    .map((text) => `<p class="info-text info-text--highlight">${text}</p>`)
    .join("");
}

function initCharacterSection(root, characters) {
  if (!characters.length) return;

  const imagesNav = root.querySelector("[data-character-images-nav]");
  const sliderRoot = root.querySelector("[data-character-slider]");
  const sliderTrack = root.querySelector("[data-character-slider-track]");
  const nameEl = root.querySelector("[data-character-name]");
  const bioEl = root.querySelector("[data-character-bio]");
  const specsEl = root.querySelector("[data-character-specs]");
  const switcherPrev = root.querySelector("[data-character-prev]");
  const switcherNext = root.querySelector("[data-character-next]");

  if (!sliderRoot || !sliderTrack) return;

  let activeCharacterIndex = 0;
  let activeImageIndex = 0;
  let imageAutoplayTimer = null;

  const switcher = buildThumbnailSwitcher(root, characters, (index) =>
    setActiveCharacter(index),
  );

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

  // --- Peek-carousel centering math, scoped to CHARACTER slides now -----------------------
  const offsetForCharacterIndex = (index) => {
    const slideEls = slides();
    const slide = slideEls[index];
    if (!slide) return 0;

    const containerWidth = sliderRoot.getBoundingClientRect().width;
    const slideWidth = slide.getBoundingClientRect().width;
    const slideCenter = slide.offsetLeft + slideWidth / 2;

    return containerWidth / 2 - slideCenter;
  };

  // --- "Images 1 – 2 – 3 – 4 – 5" -------
  const renderImageDots = () => {
    if (!imagesNav) return;

    const images = characters[activeCharacterIndex].images || [];

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

    imagesNav.querySelectorAll("[data-character-image-dot]").forEach((dot) => {
      dot.addEventListener("click", () => {
        goToImage(Number(dot.dataset.characterImageDot));
        restartImageAutoplay(); // manual pick resets the clock, same as the Story slider
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

    activeImageIndex = ((index % imgs.length) + imgs.length) % imgs.length;
    imgs.forEach((img, i) =>
      img.classList.toggle("is-active", i === activeImageIndex),
    );

    renderImageDots();
  };

  // --- Auto-advances the active character's images every 5s. ---------
  const restartImageAutoplay = () => {
    clearInterval(imageAutoplayTimer);
    const images = characters[activeCharacterIndex]?.images || [];
    if (images.length > 1) {
      imageAutoplayTimer = setInterval(
        () => goToImage(activeImageIndex + 1),
        5000,
      );
    }
  };

  // --- Switches which character is centered: name, bio, thumbnail
  //     highlight, and slides the carousel to reveal it. ----------------
  const setActiveCharacter = (index, animate = true) => {
    activeCharacterIndex = (index + characters.length) % characters.length;
    activeImageIndex = 0;
    switcher.updateHighlight(activeCharacterIndex);

    const character = characters[activeCharacterIndex];
    if (nameEl) nameEl.textContent = character.name;
    if (bioEl) bioEl.innerHTML = renderCharacterDescription(character);
    if (specsEl) specsEl.innerHTML = renderCharacterSpecs(character);

    slides().forEach((slide, i) => {
      slide.classList.toggle("is-active", i === activeCharacterIndex);
    });

    renderImageDots();
    restartImageAutoplay();

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

  setActiveCharacter(0, false);
}

// --- Model viewer: same thumbnail-switcher pattern ---------------------------
function initModelViewerSection(root, characters) {
  if (!characters.length) return;

  const video = root.querySelector("[data-model-viewer-video]");
  const nameEl = root.querySelector("[data-model-viewer-name]");
  const prevBtn = root.querySelector("[data-model-viewer-prev]");
  const nextBtn = root.querySelector("[data-model-viewer-next]");

  if (!video) return;

  let activeIndex = 0;

  const switcher = buildThumbnailSwitcher(root, characters, (index) =>
    setActiveCharacter(index),
  );

  const setActiveCharacter = (index) => {
    activeIndex = (index + characters.length) % characters.length;
    switcher.updateHighlight(activeIndex);

    const character = characters[activeIndex];
    if (nameEl) nameEl.textContent = character.name;

    video.pause();
    video.src = character.model_video;
    video.muted = true; // required by browser autoplay policies
    video.load();

    // Autoplay isn't guaranteed to fire just from the `autoplay`
    // attribute after a src swap on every browser, so kick it off
    // explicitly too — same quiet-retry pattern as the audio player.
    const tryPlay = () => video.play().catch(() => {});
    video.addEventListener("loadedmetadata", tryPlay, { once: true });
    tryPlay();
  };

  prevBtn?.addEventListener("click", () => setActiveCharacter(activeIndex - 1));
  nextBtn?.addEventListener("click", () => setActiveCharacter(activeIndex + 1));

  setActiveCharacter(0);
}

loadCharacters();
