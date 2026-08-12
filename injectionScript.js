async function loadCharacters() {
  try {
    const response = await fetch("/api/characters");

    // Check if the server returned an error
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    console.log(data);

    // on appelle la function créée plus bas!
    displayCharacters(data);
  } catch (error) {
    console.error("Error loading characters:", error);
  }
}

function displayCharacters(characters) {
  const container = document.querySelector(".characters");

  // Make sure the container exists
  if (!container) {
    console.error("Characters container not found.");
    return;
  }

  characters.forEach((character, index) => {
    // Character card
    const characterCard = document.createElement("article");
    characterCard.classList.add("character-card");
    characterCard.classList.add(`character-card-${index + 1}`);
    container.appendChild(characterCard);

    const characterName = document.createElement("h2");
    characterName.classList.add("character-name");
    characterName.classList.add(`character-name-${index + 1}`);
    characterName.innerHTML = character.name;
    characterCard.appendChild(characterName);

    const characterdescription = document.createElement("p");
    characterdescription.classList.add("character-description");
    characterdescription.classList.add(`character-description-${index + 1}`);
    characterdescription.innerHTML = character.description;
    characterCard.appendChild(characterdescription);

    // conteneur pour mes multiples images
    const characterImagesContainer = document.createElement("div");
    characterImagesContainer.classList.add(
      `${character.name.replaceAll(" ", "-")}-images-container`,
    );
    characterCard.appendChild(characterImagesContainer);

    // la loop pour les images
    character.images.forEach((image) => {
      const characterImage = document.createElement("img");
      characterImage.classList.add("character-image");
      characterImage.classList.add(`character-image-${index + 1}`);

      characterImage.src = image;
      characterImagesContainer.appendChild(characterImage);
    });
  });
}

loadCharacters();
