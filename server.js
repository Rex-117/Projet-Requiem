const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

const data = require("./characters.json");

app.use(express.static(path.join(__dirname)));

// API route
app.get("/api/characters", (req, res) => {
  const charactersInfo = data.characters.map((character) => {
    return {
      name: character.name,
      age: character.age,
      pob: character.pob,
      nationality: character.nationality,
      affiliation: character.affiliation,
      family: character.family,
      images: character.images,
      description: character.description,
    };
  });

  res.json(charactersInfo);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
