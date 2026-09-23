const express = require("express");
const router = express.Router();
const pool = require("../db");

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  getCurrentSemester,
  getDepartmentsByFaculty,
  getFaculties,
  getLevels,
  getAvailableCourses,
  registerCourses,
  getMyCourses,
  removeCourseRegistration,
  getLecturerDashboard
} = require("../controllers/lecturerCourseRegistrationControllers");

const initLecturerCourseRegistrationTable = async () => {
  try {
    const createTable = `
      CREATE TABLE IF NOT EXISTS lecturer_course_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,

        lecturer_id INT NOT NULL,
        semester_id INT NOT NULL,
        faculty_id INT NOT NULL,
        department_id INT NOT NULL,
        level_id INT NOT NULL,
        course_id INT NOT NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (
          lecturer_id,
          semester_id,
          course_id
        ),

        FOREIGN KEY (lecturer_id)
          REFERENCES lecturers(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        FOREIGN KEY (semester_id)
          REFERENCES semesters(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        FOREIGN KEY (faculty_id)
          REFERENCES faculties(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        FOREIGN KEY (department_id)
          REFERENCES departments(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        FOREIGN KEY (level_id)
          REFERENCES levels(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        FOREIGN KEY (course_id)
          REFERENCES courses(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      )
    `;

    await pool.query(createTable);

    console.log("✅ Lecturer course registration table ready");
  } catch (err) {
    console.error(
      "❌ Error creating lecturer course registration table:",
      err
    );
  }
};

initLecturerCourseRegistrationTable();

router.get("/current-semester", authMiddleware, requireRole("lecturer"), getCurrentSemester);
router.get("/departments/:facultyId", authMiddleware, requireRole("lecturer"), getDepartmentsByFaculty);
router.get("/faculties", authMiddleware, requireRole("lecturer"), getFaculties);
router.get("/levels", authMiddleware, requireRole("lecturer"), getLevels);
router.get("/courses", authMiddleware, requireRole("lecturer"),getAvailableCourses);
router.post("/", authMiddleware, requireRole("lecturer"), registerCourses);
router.get("/", authMiddleware, requireRole("lecturer"),getMyCourses);
router.delete("/:id", authMiddleware, requireRole("lecturer"), removeCourseRegistration);
router.get("/dashboard",authMiddleware,requireRole("lecturer"), getLecturerDashboard);

module.exports = router;