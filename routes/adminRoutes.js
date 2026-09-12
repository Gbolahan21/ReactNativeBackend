const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


const initAdminsTable = async () => {
  try {
    const createAdminsTable = `
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstname VARCHAR(100) NOT NULL,
        lastname VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        title ENUM('Mr', 'Mrs') NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await pool.query(createAdminsTable);

    console.log("✅ Admins table ready");
  } catch (err) {
    console.error("❌ Error creating admins table:", err);
  }
};

initAdminsTable();

router.post("/admin/signup", async (req, res) => {
  const {
    firstname,
    lastname,
    email,
    title,
    password,
  } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO admins
      (firstname, lastname, email, title, password)
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
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error: "Email already exists",
      });
    }

    res.status(500).json({
      error: err.message,
    });
  }
});

router.post('/admin/signin', async(req, res) => {
    const { email, password } = req.body;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM admins WHERE email = ?',
            [email]
        )

        if (rows.length === 0) {
          return res.status(400).json({ error: 'User not found' });
        }

        const user = rows[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.status(400).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ id: user.id,  email: user.email, }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
          message: 'Login successful',
          token: token,
          user: {
            id: user.id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            title: user.title,
          },
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

router.get("/admin/dashboard", async (req, res) => {
  try {
    const [[studentCount]] = await pool.query(`
      SELECT COUNT(*) AS totalStudents
      FROM users
    `);

    const [[presentToday]] = await pool.query(`
      SELECT COUNT(*) AS presentToday
      FROM attendance
      WHERE attendance_date = CURDATE()
      AND status = 'Present'
    `);

    const absentToday =
      studentCount.totalStudents - presentToday.presentToday;

    const attendanceRate =
      studentCount.totalStudents === 0
        ? 0
        : Math.round(
            (presentToday.presentToday /
              studentCount.totalStudents) *
              100
          );

    res.json({
      totalStudents: studentCount.totalStudents,
      presentToday: presentToday.presentToday,
      absentToday,
      attendanceRate,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

router.get("/admin/students", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search || "";

    const offset = (page - 1) * limit;

    const searchTerm = `%${search}%`;

    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM users
      WHERE
        firstname LIKE ?
        OR lastname LIKE ?
        OR matricNo LIKE ?
      `,
      [searchTerm, searchTerm, searchTerm]
    );

    const [students] = await pool.query(
      `
      SELECT
        id,
        firstname,
        lastname,
        matricNo,
        department,
        faculty
      FROM users
      WHERE
        firstname LIKE ?
        OR lastname LIKE ?
        OR matricNo LIKE ?
      ORDER BY firstname ASC
      LIMIT ?
      OFFSET ?
      `,
      [searchTerm, searchTerm, searchTerm, limit, offset]
    );

    res.json({
      records: students,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;