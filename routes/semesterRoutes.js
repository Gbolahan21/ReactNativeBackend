const express = require("express");
const router = express.Router();
const adminMiddleware = require("../middleware/adminMiddleware");

const {
  createSemester,
  getSemesters,
  getSemesterById,
  updateSemester,
  deleteSemester,
} = require("../controllers/semesterControllers");


const initSemesterTable = async () => {
  try {
    const createSemesterTable = `
      CREATE TABLE IF NOT EXISTS semesters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
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

router.post("/", adminMiddleware, createSemester);
router.get("/", adminMiddleware, getSemesters);
router.get("/:id", adminMiddleware, getSemesterById);
router.put("/:id", adminMiddleware, updateSemester);
router.delete("/:id", adminMiddleware, deleteSemester);


module.exports = router;