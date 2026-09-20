const express = require("express");
const pool = require("../db");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  createFaculty,
  getFaculties,
  getFacultyById,
  updateFaculty,
  deleteFaculty,
} = require("../controllers/facultyControllers");

const initFacultyTable = async () => {
  try {
    const createFacultyTable = `
      CREATE TABLE IF NOT EXISTS faculties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await pool.query(createFacultyTable);
    console.log("✅ Faculty table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
};

initFacultyTable();

router.post("/", authMiddleware, requireRole("admin"), createFaculty);
router.get("/", authMiddleware, requireRole("admin"), getFaculties);
router.get("/:id", authMiddleware, requireRole("admin"), getFacultyById);
router.put("/:id", authMiddleware, requireRole("admin"), updateFaculty);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteFaculty);


module.exports = router;