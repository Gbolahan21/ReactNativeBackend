const express = require("express");
const pool = require("../db");

const router = express.Router();


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


module.exports = router;