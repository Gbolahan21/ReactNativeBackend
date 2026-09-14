const express = require("express");
const router = express.Router();
const pool = require("../db");
const adminMiddleware = require("../middleware/adminMiddleware");

const {
  createLevel,
  getLevels,
  getLevelById,
  updateLevel,
  deleteLevel,
} = require("../controllers/levelControllers");


const initLevelTable = async () => {
  try {
    const createLevelTable = `
      CREATE TABLE IF NOT EXISTS levels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await pool.query(createLevelTable);
    console.log("✅ Level table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
};

initLevelTable();

router.post("/", adminMiddleware, createLevel);
router.get("/", adminMiddleware, getLevels);
router.get("/:id", adminMiddleware, getLevelById);
router.put("/:id", adminMiddleware, updateLevel);
router.delete("/:id", adminMiddleware, deleteLevel);


module.exports = router;