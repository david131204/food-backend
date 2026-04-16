const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend is working");
});

app.get("/foods/search", async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) {
      return res.status(400).json({ error: "Missing search query" });
    }

    const response = await fetch("https://api.nal.usda.gov/fdc/v1/foods/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.USDA_API_KEY,
      },
      body: JSON.stringify({
        query: q,
        pageSize: 10,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const result = await response.json();

   const foods = (result.foods || [])
  .filter(item => !item.brandOwner) 
  .slice(0, 10)
  .map((item) => {
      const nutrients = item.foodNutrients || [];

      const getNutrient = (name) => {
        const found = nutrients.find(
          (n) => n.nutrientName?.toLowerCase() === name.toLowerCase()
        );
        return found?.value ?? 0;
      };

      return {
        id: String(item.fdcId),
        source: "usda",
        name: item.description,
        brand: item.brandOwner || null,
        servingBasis: "100g",
        caloriesPer100g: getNutrient("Energy"),
        proteinPer100g: getNutrient("Protein"),
        carbsPer100g: getNutrient("Carbohydrate, by difference"),
        fatPer100g: getNutrient("Total lipid (fat)"),
      };
    });

    res.json(foods);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Search failed" });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log(`Server running on port ${process.env.PORT || 3001}`);
});