const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/admin/register", async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      title,
      password,
    } = req.body;

    if (
      !firstname ||
      !lastname ||
      !email ||
      !title ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check existing email
    const [existingAdmin] = await pool.query(
      "SELECT id FROM admins WHERE email = ?",
      [email]
    );

    if (existingAdmin.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `
        INSERT INTO admins
        (
          firstname,
          lastname,
          email,
          title,
          password
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        firstname,
        lastname,
        email,
        title,
        hashedPassword,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      adminId: result.insertId,
    });

  } catch (error) {
    console.error("Admin registration error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/lecturer/register", async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      staff_id,
      password,
    } = req.body;

    if (
      !firstname ||
      !lastname ||
      !email ||
      !staff_id ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check email
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

    // Check staff ID
    const [existingStaff] = await pool.query(
      "SELECT id FROM lecturers WHERE staff_id = ?",
      [staff_id]
    );

    if (existingStaff.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Staff ID is already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `
        INSERT INTO lecturers
        (
          firstname,
          lastname,
          email,
          password,
          staff_id
        )
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

  } catch (error) {
    console.error("Lecturer registration error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // -------------------------
    // Check Admin
    // -------------------------
    const [admins] = await pool.query(
      `
        SELECT
          id,
          firstname,
          lastname,
          email,
          password,
          title
        FROM admins
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    if (admins.length > 0) {
      const admin = admins[0];

      const passwordMatch = await bcrypt.compare(
        password,
        admin.password
      );

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const token = jwt.sign(
        {
          id: admin.id,
          email: admin.email,
          role: "admin",
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        role: 'admin',
        user: {
          id: admin.id,
          firstname: admin.firstname,
          lastname: admin.lastname,
          email: admin.email,
          title: admin.title,
        },
      });
    }

    // -------------------------
    // Check Lecturer
    // -------------------------
    const [lecturers] = await pool.query(
      `
        SELECT
          id,
          firstname,
          lastname,
          email,
          password,
          staff_id,
          status
        FROM lecturers
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    if (lecturers.length > 0) {
      const lecturer = lecturers[0];

      if (lecturer.status !== "Active") {
        return res.status(403).json({
          success: false,
          message: "Your lecturer account is inactive",
        });
      }

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
          email: lecturer.email,
          role: "lecturer",
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        role: 'lecturer',
        user: {
          id: lecturer.id,
          firstname: lecturer.firstname,
          lastname: lecturer.lastname,
          email: lecturer.email,
          staff_id: lecturer.staff_id,
          status: lecturer.status,
        },
      });
    }

    // No account found
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.get("/load", authMiddleware, async (req, res) => {
  try {
    const { id, role } = req.user;

    // -------------------------
    // Load Admin
    // -------------------------
    if (role === "admin") {
      const [rows] = await pool.query(
        `
          SELECT
            id,
            firstname,
            lastname,
            email,
            title
          FROM admins
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Admin not found",
        });
      }

      return res.json({
        success: true,
        message: "Session restored",
        role: "admin",
        user: rows[0],
      });
    }

    // -------------------------
    // Load Lecturer
    // -------------------------
    if (role === "lecturer") {
      const [rows] = await pool.query(
        `
          SELECT
            id,
            firstname,
            lastname,
            email,
            staff_id,
            status
          FROM lecturers
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Lecturer not found",
        });
      }

      const lecturer = rows[0];

      // Check account status
      if (lecturer.status !== "Active") {
        return res.status(403).json({
          error: true,
          message: "Your lecturer account is inactive",
        });
      }

      return res.json({
        success: true,
        message: "Session restored",
        role: "lecturer",
        user: lecturer,
      });
    }

    // -------------------------
    // Invalid role
    // -------------------------
    return res.status(403).json({
      error: true,
      message: "Invalid user role",
    });

  } catch (err) {
    console.error("LOAD ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Server error",
    });
  }
});

module.exports = router;