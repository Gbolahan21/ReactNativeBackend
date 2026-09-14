const express = require("express");

const router = express.Router();
const adminMiddleware = require("../middleware/adminMiddleware");

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

router.post("/", adminMiddleware, createFaculty);
router.get("/", adminMiddleware, getFaculties);
router.get("/:id", adminMiddleware, getFacultyById);
router.put("/:id", adminMiddleware, updateFaculty);
router.delete("/:id", adminMiddleware, deleteFaculty);


module.exports = router;