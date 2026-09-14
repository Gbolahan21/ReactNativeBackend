const express = require("express");
const pool = require("../db");

const router = express.Router();


const initLevelTable = async () => {
  try {
    const createLevelTable = `
      CREATE TABLE IF NOT EXISTS levels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await pool.query(createLevelTable);
    console.log("✅ Level table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
};

initLevelTable();


module.exports = router;