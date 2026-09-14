const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const studentMiddleware = require("../middleware/studentMiddleware");

const router = express.Router();

const initStudentsTable = async () => {
  try {
    const createStudentsTable = `
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstname VARCHAR(100) NOT NULL,
        lastname VARCHAR(100) NOT NULL,
        matricNo VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        department_id INT NOT NULL,
        faculty_id INT NOT NULL,
        level_id INT NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_student_department
          FOREIGN KEY (department_id)
          REFERENCES departments(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,
        CONSTRAINT fk_student_faculty
          FOREIGN KEY (faculty_id)
          REFERENCES faculties(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,
        CONSTRAINT fk_student_level
          FOREIGN KEY (level_id)
          REFERENCES levels(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT
      )
    `;

    await pool.query(createStudentsTable);
    console.log("✅ Students table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
};

initStudentsTable();

router.post('/signup', async (req, res) => {
  const { firstname, lastname, matricNo, email, department, faculty, level, password } = req.body;

  if (!firstname || !lastname || !matricNo || !email || !department || !faculty || !level || !password) {
    return res.status(400).json({
      error: "All fields are required.",
    });
  }

  const studentEmailRegex = /^[^\s@]+@student\.lautech\.edu\.ng$/i;

  if (!studentEmailRegex.test(email)) {
    return res.status(400).json({
      error: "Please use a valid LAUTECH student email.",
    });
  }

  const validLevels = ["100", "200", "300", "400", "500", "600"];

  if (!validLevels.includes(String(level))) {
    return res.status(400).json({
      error: "Invalid student level.",
    });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
    });
  }

  try {
    const hashPassword = await bcrypt.hash(password, 10);

    await pool.query(
        'INSERT INTO students (firstname, lastname, matricNo, email, department, faculty, level, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [firstname, lastname, matricNo, email, department, faculty, level, hashPassword]
    );

    res.status(201).json({
        success: true,
        message: "Registration successful",
    });
  } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        // Check which unique field caused the error
        if (err.sqlMessage.includes("matricNo")) {
          return res.status(400).json({
            error: "Matric number already exists.",
          });
        }

        if (err.sqlMessage.includes("email")) {
          return res.status(400).json({
            error: "Email already exists.",
          });
        }

        return res.status(400).json({
          error: "Student already exists.",
        });
      }

      console.error("Registration error:", err);

      res.status(500).json({
          error: "Internal server error",
      });
  }
})

router.post('/signin', async(req, res) => {
  const { matricNo, password } = req.body;

  try {
      const [rows] = await pool.query(
          'SELECT * FROM students WHERE matricNo = ?',
          [matricNo]
      )

      if (rows.length === 0) {
        return res.status(400).json({ error: 'Student not found' });
      }

      const student = rows[0];

      const isMatch = await bcrypt.compare(password, student.password);

      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid password' });
      }

      const token = jwt.sign({ id: student.id,  matricNo: student.matricNo, }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: 'Login successful',
        token: token,
        student: {
          id: student.id,
          firstname: student.firstname,
          lastname: student.lastname,
          matricNo: student.matricNo,
          email: student.email,
          department: student.department,
          faculty: student.faculty,
          level: student.level,
        },
      });

  } catch (err) {
      res.status(500).json({ error: err.message });
  }
})

router.get("/load", studentMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        id,
        firstname,
        lastname,
        matricNo,
        email,
        department,
        faculty,
        level
       FROM students
       WHERE id = ?`,
      [req.student.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    const student = rows[0];

    res.json({
      message: "Session restored",
      student,
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

router.get("/faculties", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT faculty
      FROM students
      WHERE faculty IS NOT NULL
        AND faculty != ''
      ORDER BY faculty ASC
    `);

    res.json({
      faculties: rows.map((row) => row.faculty),
    });
  } catch (err) {
    console.error("Error fetching faculties:", err);

    res.status(500).json({
      error: "Failed to fetch faculties",
    });
  }
});

router.get("/departments", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT department
      FROM students
      WHERE department IS NOT NULL
        AND department != ''
      ORDER BY department ASC
    `);

    res.json({
      departments: rows.map((row) => row.department),
    });
  } catch (err) {
    console.error("Error fetching departments:", err);

    res.status(500).json({
      error: "Failed to fetch departments",
    });
  }
});

router.get("/levels", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT level
      FROM students
      WHERE level IS NOT NULL
        AND level != ''
      ORDER BY level ASC
    `);

    res.json({
      levels: rows.map((row) => row.level),
    });
  } catch (err) {
    console.error("Error fetching levels:", err);

    res.status(500).json({
      error: "Failed to fetch levels",
    });
  }
});


module.exports = router;