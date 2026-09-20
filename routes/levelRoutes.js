const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

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

router.post("/", authMiddleware, requireRole("admin"), createLevel);
router.get("/", authMiddleware, requireRole("admin"), getLevels);
router.get("/:id", authMiddleware, requireRole("admin"), getLevelById);
router.put("/:id", authMiddleware, requireRole("admin"), updateLevel);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteLevel);


module.exports = router;