const express = require("express");
const path = require("path");

const app = express();
// const PORT = 3000;
const PORT = process.env.PORT || 3000;

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
      job: character.job,
      family: character.family,
      status: character.status,
      sex: character.sex,
      bloodType: character.bloodType,
      isConfirmed: character.isConfirmed,
      images: character.images,
      thumbnail_image: character.thumbnail_image,
      model_video: character.model_video,
      description: character.description,
    };
  });

  res.json(charactersInfo);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
