const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  createSemester,
  getSemesters,
  getSemesterById,
  updateSemester,
  deleteSemester,
  setCurrentSemester
} = require("../controllers/semesterControllers");


const initSemesterTable = async () => {
  try {
    const createSemesterTable = `
      CREATE TABLE IF NOT EXISTS semesters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        is_current BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await pool.query(createSemesterTable);
    console.log("✅ Semester table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
};

initSemesterTable();

router.post("/", authMiddleware, requireRole("admin"), createSemester);
router.get("/", authMiddleware, requireRole("admin"), getSemesters);
router.get("/:id", authMiddleware, requireRole("admin"), getSemesterById);
router.put("/:id", authMiddleware, requireRole("admin"), updateSemester);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteSemester);
router.patch("/:id/current", authMiddleware, requireRole("admin"), setCurrentSemester);


module.exports = router;