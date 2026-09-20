const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

router.post("/register", async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      password,
      staff_id,
    } = req.body;

    // Validate required fields
    if (!firstname || !lastname || !email || !password || !staff_id) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check if email already exists
    const [existingEmail] = await pool.query(
      "SELECT id FROM lecturers WHERE email = ?",
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    // Check if staff ID already exists
    const [existingStaffId] = await pool.query(
      "SELECT id FROM lecturers WHERE staff_id = ?",
      [staff_id]
    );

    if (existingStaffId.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Staff ID is already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create lecturer
    const [result] = await pool.query(
      `
        INSERT INTO lecturers
        (firstname, lastname, email, password, staff_id)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        firstname,
        lastname,
        email,
        hashedPassword,
        staff_id,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Lecturer registered successfully",
      lecturerId: result.insertId,
    });

  } catch (err) {
    console.error("Lecturer registration error:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find lecturer
    const [rows] = await pool.query(
      `
        SELECT * FROM lecturers WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const lecturer = rows[0];

    // Check account status
    if (lecturer.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: "Your lecturer account is inactive",
      });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(
      password,
      lecturer.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
        {
            id: lecturer.id,
            role: "lecturer",
            email: lecturer.email,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1d",
        }
    );

    // Successful login
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,

      lecturer: {
        id: lecturer.id,
        firstname: lecturer.firstname,
        lastname: lecturer.lastname,
        email: lecturer.email,
        staff_id: lecturer.staff_id,
        status: lecturer.status,
      },
    });

  } catch (err) {
    console.error("Lecturer login error:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


module.exports = router;