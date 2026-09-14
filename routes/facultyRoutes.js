const express = require("express");
const pool = require("../db");

const router = express.Router();


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


module.exports = router;