const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const adminMiddleware = require("../middleware/adminMiddleware");

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

router.post("/signup", async (req, res) => {
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

router.post('/signin', async(req, res) => {
    const { email, password } = req.body;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM admins WHERE email = ?',
            [email]
        )

        if (rows.length === 0) {
          return res.status(400).json({ error: true, message: 'Admin not found' });
        }

        const admin = rows[0];

        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
          return res.status(400).json({ error: true, message: 'Invalid password' });
        }

        const token = jwt.sign({ id: admin.id,  email: admin.email, }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
          message: 'Login successful',
          token: token,
          admin: {
            id: admin.id,
            firstname: admin.firstname,
            lastname: admin.lastname,
            email: admin.email,
            title: admin.title,
          },
        });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
})

router.get("/dashboard", async (req, res) => {
  try {
    const [[studentCount]] = await pool.query(`
      SELECT COUNT(*) AS totalStudents
      FROM students
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

router.get("/students", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);

    const requestedLimit = Number(req.query.limit) || 10;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);

    const search = req.query.search || "";
    const offset = (page - 1) * limit;
    const searchTerm = `%${search}%`;

    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM students
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
        s.id,
        s.firstname,
        s.lastname,
        s.matricNo,
        s.email,
        s.gender,
        s.status,
        s.created_at,

        d.name AS department,
        f.name AS faculty,
        l.name AS level,

        sem.name AS semester

      FROM students s

      LEFT JOIN departments d
        ON s.department_id = d.id

      LEFT JOIN faculties f
        ON s.faculty_id = f.id

      LEFT JOIN levels l
        ON s.level_id = l.id

      LEFT JOIN semesters sem
        ON sem.is_current = TRUE

      WHERE
        s.firstname LIKE ?
        OR s.lastname LIKE ?
        OR s.matricNo LIKE ?

      ORDER BY s.firstname ASC

      LIMIT ?
      OFFSET ?
      `,
      [
        searchTerm,
        searchTerm,
        searchTerm,
        limit,
        offset,
      ]
    );

    res.json({
      records: students,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });

  } catch (err) {
    console.error("GET STUDENTS ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});
router.get("/load", adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        id,
        firstname,
        lastname,
        email
       FROM admins
       WHERE id = ?`,
      [req.admin.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Admin not found",
      });
    }

    const admin = rows[0];

    res.json({
      message: "Session restored",
      admin,
    });

  } catch (err) {
    console.error("LOAD ERROR:", err);

    res.status(500).json({
      error: true,
      message: err.message,
    });
  }
});

module.exports = router;