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

    const searchTerm = q.trim().toLowerCase();

    const response = await fetch("https://api.nal.usda.gov/fdc/v1/foods/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.USDA_API_KEY,
      },
      body: JSON.stringify({
        query: searchTerm,
        pageSize: 100,
        dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const result = await response.json();

    const foods = (result.foods || [])
      .filter((item) => {
        const nutrients = item.foodNutrients || [];

        const energy = nutrients.find(
          (n) =>
            n.nutrientName?.toLowerCase() === "energy" &&
            n.unitName?.toLowerCase() === "kcal"
        );

        return energy && energy.value > 0;
      })
      .sort((a, b) => {
        const aName = a.description.toLowerCase();
        const bName = b.description.toLowerCase();

        // prioritise results that contain the search words (any order)
        const aMatch = searchTerm.split(" ").every(word => aName.includes(word));
        const bMatch = searchTerm.split(" ").every(word => bName.includes(word));

        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;

        // prioritise non-branded foods
        const aBranded = a.brandOwner || a.brandName;
        const bBranded = b.brandOwner || b.brandName;

        if (!aBranded && bBranded) return -1;
        if (aBranded && !bBranded) return 1;

        return aName.length - bName.length;
      })
      .slice(0, 10)
      .map((item) => {
        const nutrients = item.foodNutrients || [];

        const getNutrient = (name, unit = null) => {
          const found = nutrients.find((n) => {
            const sameName =
              n.nutrientName?.toLowerCase() === name.toLowerCase();

            if (!unit) return sameName;

            return (
              sameName &&
              n.unitName?.toLowerCase() === unit.toLowerCase()
            );
          });

          return found?.value ?? 0;
        };

        return {
          id: String(item.fdcId),
          source: "usda",
          name: item.description,
          brand: item.brandOwner || item.brandName || null,
          servingBasis: "100g",
          caloriesPer100g: getNutrient("Energy", "KCAL"),
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