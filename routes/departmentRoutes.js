const express = require("express");
const pool = require("../db");

const router = express.Router();


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


module.exports = router;