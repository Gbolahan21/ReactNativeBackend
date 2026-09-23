const express = require("express");
const router = express.Router();
const pool = require("../db");

// Create lecturers table
const initLecturerTable = async () => {
  try {
    const createLecturerTable = `
      CREATE TABLE IF NOT EXISTS lecturers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstname VARCHAR(100) NOT NULL,
        lastname VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        staff_id VARCHAR(50) UNIQUE,
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await pool.query(createLecturerTable);
    console.log("✅ Lecturer table ready");
  } catch (err) {
    console.error("❌ Error creating lecturer table:", err);
  }
};

initLecturerTable();


module.exports = router;