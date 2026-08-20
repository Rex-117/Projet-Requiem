// Resident Evil Requiem — Character page
// Separates confirmed and unconfirmed characters
// and initializes one independent carousel for each section.

async function loadCharacters() {
  try {
    const response = await fetch("/api/characters");

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const characters = await response.json();

    console.log("ALL CHARACTERS:", characters);

    console.log(characters[0]);
    console.log(characters[0].isConfirmed);
    console.log(typeof characters[0].isConfirmed);
    console.log(Object.keys(characters[0]));

    // ---------------------------------------------------------
    // Separate confirmed / unconfirmed characters
    // ---------------------------------------------------------

    const confirmedCharacters = characters.filter(
      (character) => character.isConfirmed === true
    );

    const unconfirmedCharacters = characters.filter(
      (character) => character.isConfirmed === false
    );

    console.log("CONFIRMED:", confirmedCharacters);
    console.log("UNCONFIRMED:", unconfirmedCharacters);

    // ---------------------------------------------------------
    // Find both HTML sections
    // ---------------------------------------------------------

    const confirmedSection = document.querySelector(
      '[data-character-section="confirmed"]'
    );

    const unconfirmedSection = document.querySelector(
      '[data-character-section="unconfirmed"]'
    );

    console.log("CONFIRMED SECTION:", confirmedSection);
    console.log("UNCONFIRMED SECTION:", unconfirmedSection);

    // ---------------------------------------------------------
    // Initialize both sections
    // ---------------------------------------------------------

    initCharacterSection(
      confirmedCharacters,
      confirmedSection
    );

    initCharacterSection(
      unconfirmedCharacters,
      unconfirmedSection
    );

  } catch (error) {
    console.error("Error loading characters:", error);
  }
}


// =========================================================
// INITIALIZE ONE CHARACTER SECTION
// =========================================================

function initCharacterSection(characters, section) {

  if (!section) {
    console.error("Character section not found");
    return;
  }

  if (!Array.isArray(characters) || characters.length === 0) {
    console.error(
      "No characters found for section:",
      section
    );

    return;
  }


  // ---------------------------------------------------------
  // Elements inside THIS section only
  // ---------------------------------------------------------

  const switcherTrack = section.querySelector(
    "[data-character-track]"
  );

  const switcherPrev = section.querySelector(
    "[data-character-prev]"
  );

  const switcherNext = section.querySelector(
    "[data-character-next]"
  );

  const imagesNav = section.querySelector(
    "[data-character-images-nav]"
  );

  const sliderRoot = section.querySelector(
    "[data-character-slider]"
  );

  const sliderTrack = section.querySelector(
    "[data-character-slider-track]"
  );

  const nameEl = section.querySelector(
    "[data-character-name]"
  );

  const bioEl = section.querySelector(
    "[data-character-bio]"
  );


  if (!switcherTrack || !sliderRoot || !sliderTrack) {
    console.error(
      "Missing required character elements inside:",
      section
    );

    return;
  }


  // ---------------------------------------------------------
  // Current indexes
  // ---------------------------------------------------------

  let activeCharacterIndex = 0;
  let activeImageIndex = 0;


  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------

  function currentCharacter() {
    return characters[activeCharacterIndex];
  }


  function currentImages() {
    return currentCharacter()?.images || [];
  }


  // ---------------------------------------------------------
  // Create thumbnail switcher
  // ---------------------------------------------------------

  switcherTrack.innerHTML = "";


  characters.forEach((character, index) => {

    const thumb = document.createElement("button");

    thumb.type = "button";

    thumb.className =
      "character-switcher__thumb";

    thumb.dataset.characterIndex =
      String(index);

    thumb.setAttribute(
      "aria-label",
      character.name
    );


    const img = document.createElement("img");

    img.src =
      character.images?.[0] || "";

    img.alt =
      character.name;

    img.draggable =
      false;


    thumb.appendChild(img);


    thumb.addEventListener(
      "click",
      () => {
        setActiveCharacter(index);
      }
    );


    switcherTrack.appendChild(thumb);

  });


  // ---------------------------------------------------------
  // Highlight current character thumbnail
  // ---------------------------------------------------------

  function updateSwitcherHighlight() {

    const thumbnails =
      switcherTrack.querySelectorAll(
        "[data-character-index]"
      );


    thumbnails.forEach((thumb) => {

      const thumbIndex =
        Number(
          thumb.dataset.characterIndex
        );


      thumb.classList.toggle(
        "is-active",
        thumbIndex === activeCharacterIndex
      );

    });

  }


  // ---------------------------------------------------------
  // Calculate carousel offset
  // ---------------------------------------------------------

  function offsetForImageIndex(index) {

    const slides =
      sliderTrack.querySelectorAll(
        "[data-character-slide]"
      );


    const slide =
      slides[index];


    if (!slide) {
      return 0;
    }


    const containerWidth =
      sliderRoot
        .getBoundingClientRect()
        .width;


    const slideWidth =
      slide
        .getBoundingClientRect()
        .width;


    const slideCenter =
      slide.offsetLeft +
      slideWidth / 2;


    return (
      containerWidth / 2 -
      slideCenter
    );

  }


  // ---------------------------------------------------------
  // Render image navigation
  // ---------------------------------------------------------

  function renderImageDots() {

    if (!imagesNav) {
      return;
    }


    const images =
      currentImages();


    const dots = images
      .map(
        (_, index) => {

          return `
            <button
              type="button"
              class="media-slider__dot ${
                index === activeImageIndex
                  ? "is-active"
                  : ""
              }"
              data-character-image-dot="${index}"
              aria-label="Afficher l'image ${index + 1}"
            >
              ${index + 1}
            </button>
          `;

        }
      )
      .join(
        '<span class="media-slider__sep">–</span>'
      );


    imagesNav.innerHTML = `
      <span class="media-slider__label">
        Images
      </span>

      ${dots}
    `;


    const imageDots =
      imagesNav.querySelectorAll(
        "[data-character-image-dot]"
      );


    imageDots.forEach((dot) => {

      dot.addEventListener(
        "click",
        () => {

          const index =
            Number(
              dot.dataset.characterImageDot
            );

          goToImage(index);

        }
      );

    });

  }


  // ---------------------------------------------------------
  // Render current character images
  // ---------------------------------------------------------

  function renderCharacterImages() {

    const character =
      currentCharacter();

    const images =
      currentImages();


    sliderTrack.innerHTML =
      images
        .map(
          (src, index) => {

            return `
              <div
                class="location-slider__slide ${
                  index === 0
                    ? "is-active"
                    : ""
                }"
                data-character-slide
              >

                <img
                  src="${src}"
                  alt="${character.name} — image ${index + 1}"
                  draggable="false"
                />

              </div>
            `;

          }
        )
        .join("");


    renderImageDots();


    sliderTrack.style.transition =
      "none";


    requestAnimationFrame(() => {

      sliderTrack.style.transform =
        `translateX(${offsetForImageIndex(0)}px)`;

    });

  }


  // ---------------------------------------------------------
  // Go to specific image
  // ---------------------------------------------------------

  function goToImage(
    index,
    animate = true
  ) {

    const images =
      currentImages();


    if (!images.length) {
      return;
    }


    activeImageIndex =
      (
        index +
        images.length
      ) %
      images.length;


    const slides =
      sliderTrack.querySelectorAll(
        "[data-character-slide]"
      );


    slides.forEach(
      (slide, slideIndex) => {

        slide.classList.toggle(
          "is-active",
          slideIndex === activeImageIndex
        );

      }
    );


    if (imagesNav) {

      const dots =
        imagesNav.querySelectorAll(
          "[data-character-image-dot]"
        );


      dots.forEach((dot) => {

        dot.classList.toggle(
          "is-active",
          Number(
            dot.dataset.characterImageDot
          ) === activeImageIndex
        );

      });

    }


    sliderTrack.style.transition =
      animate
        ? "transform 0.6s ease"
        : "none";


    sliderTrack.style.transform =
      `translateX(${offsetForImageIndex(activeImageIndex)}px)`;

  }


  // ---------------------------------------------------------
  // Change active character
  // ---------------------------------------------------------

  function setActiveCharacter(index) {

    activeCharacterIndex =
      (
        index +
        characters.length
      ) %
      characters.length;


    activeImageIndex = 0;


    updateSwitcherHighlight();


    const character =
      currentCharacter();


    // -------------------------------------------------------
    // Name
    // -------------------------------------------------------

    if (nameEl) {

      nameEl.textContent =
        character.name;

    }


    // -------------------------------------------------------
    // Description
    // -------------------------------------------------------

    if (bioEl) {

      const paragraphs =
        Array.isArray(
          character.description
        )
          ? character.description
          : [
              character.description
            ].filter(Boolean);


      bioEl.innerHTML =
        paragraphs
          .map(
            (text) => {

              return `
                <p class="info-text info-text--highlight">
                  ${text}
                </p>
              `;

            }
          )
          .join("");

    }


    renderCharacterImages();

  }


  // ---------------------------------------------------------
  // Previous character
  // ---------------------------------------------------------

  switcherPrev?.addEventListener(
    "click",
    () => {

      setActiveCharacter(
        activeCharacterIndex - 1
      );

    }
  );


  // ---------------------------------------------------------
  // Next character
  // ---------------------------------------------------------

  switcherNext?.addEventListener(
    "click",
    () => {

      setActiveCharacter(
        activeCharacterIndex + 1
      );

    }
  );


  // =========================================================
  // DRAG / SWIPE
  // =========================================================

  let isDragging = false;

  let startX = 0;

  let baseOffset = 0;

  let latestDelta = 0;


  // ---------------------------------------------------------
  // Pointer down
  // ---------------------------------------------------------

  sliderTrack.addEventListener(
    "pointerdown",
    (event) => {

      isDragging = true;

      startX =
        event.clientX;

      baseOffset =
        offsetForImageIndex(
          activeImageIndex
        );

      latestDelta = 0;


      sliderRoot.classList.add(
        "is-dragging"
      );


      sliderTrack.style.transition =
        "none";


      sliderTrack.setPointerCapture?.(
        event.pointerId
      );

    }
  );


  // ---------------------------------------------------------
  // Pointer move
  // ---------------------------------------------------------

  sliderTrack.addEventListener(
    "pointermove",
    (event) => {

      if (!isDragging) {
        return;
      }


      latestDelta =
        event.clientX -
        startX;


      sliderTrack.style.transform =
        `translateX(${baseOffset + latestDelta}px)`;

    }
  );


  // ---------------------------------------------------------
  // End drag
  // ---------------------------------------------------------

  function endDrag() {

    if (!isDragging) {
      return;
    }


    isDragging = false;


    sliderRoot.classList.remove(
      "is-dragging"
    );


    const slides =
      sliderTrack.querySelectorAll(
        "[data-character-slide]"
      );


    const slideWidth =
      slides[0]
        ?.getBoundingClientRect()
        .width || 1;


    const threshold =
      slideWidth * 0.18;


    // Dragged left
    if (
      latestDelta <=
      -threshold
    ) {

      goToImage(
        activeImageIndex + 1
      );

    }

    // Dragged right
    else if (
      latestDelta >=
      threshold
    ) {

      goToImage(
        activeImageIndex - 1
      );

    }

    // Not enough movement
    else {

      goToImage(
        activeImageIndex
      );

    }

  }


  sliderTrack.addEventListener(
    "pointerup",
    endDrag
  );


  sliderTrack.addEventListener(
    "pointercancel",
    endDrag
  );


  sliderTrack.addEventListener(
    "pointerleave",
    (event) => {

      if (
        isDragging &&
        event.buttons === 0
      ) {

        endDrag();

      }

    }
  );


  // ---------------------------------------------------------
  // Re-center when screen is resized
  // ---------------------------------------------------------

  window.addEventListener(
    "resize",
    () => {

      goToImage(
        activeImageIndex,
        false
      );

    }
  );


  // ---------------------------------------------------------
  // Initial character
  // ---------------------------------------------------------

  setActiveCharacter(0);

}


// =========================================================
// START
// =========================================================

loadCharacters();