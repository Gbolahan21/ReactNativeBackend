const express = require("express");
const router = express.Router();
const pool = require("../db");

const adminMiddleware = require("../middleware/adminMiddleware");

const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} = require("../controllers/courseControllers");


const initCourseTable = async () => {
  try {
    const createCourseTable = `
      CREATE TABLE IF NOT EXISTS courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_code VARCHAR(50) NOT NULL,
        course_title VARCHAR(255) NOT NULL,
        department_id INT NOT NULL,
        level_id INT NOT NULL,
        semester_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_course_department
            FOREIGN KEY (department_id)
            REFERENCES departments(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT,
        CONSTRAINT fk_course_level
            FOREIGN KEY (level_id)
            REFERENCES levels(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT,
        CONSTRAINT fk_course_semester
            FOREIGN KEY (semester_id)
            REFERENCES semesters(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT,
        CONSTRAINT unique_course_assignment
            UNIQUE (
                course_code,
                department_id,
                level_id,
                semester_id
            )
      )
    `;

    await pool.query(createCourseTable);
    console.log("✅ Course table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
};

initCourseTable();

router.post("/", adminMiddleware, createCourse);
router.get("/", adminMiddleware, getCourses);
router.get("/:id", adminMiddleware, getCourseById);
router.put("/:id", adminMiddleware, updateCourse);
router.delete("/:id", adminMiddleware, deleteCourse);


module.exports = router;