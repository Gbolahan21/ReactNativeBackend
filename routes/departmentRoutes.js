const express = require("express");
const router = express.Router();
const pool = require("../db");

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/departmentControllers");


const initDepartmentTable = async () => {
  try {
    const createDepartmentTable = `
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        faculty_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_department_faculty
            FOREIGN KEY (faculty_id)
            REFERENCES faculties(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT,
        CONSTRAINT unique_department_per_faculty
            UNIQUE (faculty_id, name)
      )
    `;

    await pool.query(createDepartmentTable);
    console.log("✅ Department table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
};

initDepartmentTable();

router.post("/", authMiddleware, requireRole("admin"), createDepartment);
router.get("/", authMiddleware, requireRole("admin"), getDepartments);
router.get("/:id", authMiddleware, requireRole("admin"), getDepartmentById);
router.put("/:id", authMiddleware, requireRole("admin"), updateDepartment);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteDepartment);


module.exports = router;