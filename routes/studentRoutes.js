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
        gender ENUM('Male', 'Female') NULL,
        department_id INT NOT NULL,
        faculty_id INT NOT NULL,
        level_id INT NOT NULL,
        status ENUM(
          'Active',
          'Inactive',
          'Suspended',
          'Graduated',
          'Withdrawn'
        ) NOT NULL DEFAULT 'Active',
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
  const { firstname, lastname, matricNo, email, gender, department, faculty, level, password } = req.body;

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

  const validGenders = ["Male", "Female"];

  if (!validGenders.includes(gender)) {
    return res.status(400).json({
      error: true,
      message: "Invalid gender",
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
    const [[facultyRow]] = await pool.query(
      `
      SELECT id, name
      FROM faculties
      WHERE name = ?
      `,
      [faculty]
    );

    if (!facultyRow) {
      return res.status(400).json({
        error: true,
        message: "Faculty not found.",
      });
    }

    const [[departmentRow]] = await pool.query(
      `
      SELECT id, name
      FROM departments
      WHERE name = ?
        AND faculty_id = ?
      `,
      [department, facultyRow.id]
    );

    if (!departmentRow) {
      return res.status(400).json({
        error: true,
        message: "Department not found for this faculty.",
      });
    }

    const normalizedLevel = String(level)
      .trim()
      .replace(/\s*level$/i, "");

    const validLevels = ["100", "200", "300", "400", "500", "600"];

    if (!validLevels.includes(normalizedLevel)) {
      return res.status(400).json({
        error: true,
        message: "Invalid student level.",
      });
    }

    const [[levelRow]] = await pool.query(
      `
      SELECT id, name
      FROM levels
      WHERE LOWER(TRIM(name)) =
            LOWER(CONCAT(?, ' level'))
      `,
      [normalizedLevel]
    );

    if (!levelRow) {
      return res.status(400).json({
        error: true,
        message: "Invalid student level.",
      });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO students (
        firstname,
        lastname,
        matricNo,
        email,
        gender,
        department_id,
        faculty_id,
        level_id,
        password
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        firstname.trim(),
        lastname.trim(),
        matricNo.trim(),
        email.trim(),
        gender,
        departmentRow.id,
        facultyRow.id,
        levelRow.id,
        hashPassword,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful",
    });

  } catch (err) {

    if (err.code === "ER_DUP_ENTRY") {

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

    return res.status(500).json({
      error: "Internal server error",
    });
  }
})

router.post("/signin", async (req, res) => {
  const { matricNo, password } = req.body;

  try {
    const [[student]] = await pool.query(
      `
      SELECT
        s.id,
        s.firstname,
        s.lastname,
        s.matricNo,
        s.email,
        s.gender,
        s.status,
        s.password,
        d.name AS department,
        f.name AS faculty,
        l.name AS level
      FROM students s

      LEFT JOIN departments d
        ON s.department_id = d.id

      LEFT JOIN faculties f
        ON s.faculty_id = f.id

      LEFT JOIN levels l
        ON s.level_id = l.id

      WHERE s.matricNo = ?
      `,
      [matricNo]
    );

    if (!student) {
      return res.status(400).json({
        error: "Student not found",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      student.password
    );

    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid password",
      });
    }

    const token = jwt.sign(
      {
        id: student.id,
        matricNo: student.matricNo,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      message: "Login successful",
      token,

      student: {
        id: student.id,
        firstname: student.firstname,
        lastname: student.lastname,
        matricNo: student.matricNo,
        email: student.email,
        gender: student.gender,
        status: student.status,
        department: student.department,
        faculty: student.faculty,
        level: student.level,
      },
    });

  } catch (err) {
    console.error("STUDENT SIGNIN ERROR:", err);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/load", studentMiddleware, async (req, res) => {
  try {
    const [[student]] = await pool.query(
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
        l.name AS level
      FROM students s

      LEFT JOIN departments d
        ON s.department_id = d.id

      LEFT JOIN faculties f
        ON s.faculty_id = f.id

      LEFT JOIN levels l
        ON s.level_id = l.id

      WHERE s.id = ?
      `,
      [req.student.id]
    );

    if (!student) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    return res.json({
      message: "Session restored",
      student,
    });

  } catch (err) {
    console.error("LOAD STUDENT ERROR:", err);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/update", studentMiddleware, async (req, res) => {

  const studentId = req.student.id;

  const {
    firstname,
    lastname,
    gender,
    department,
    faculty,
    level,
  } = req.body;

  try {

    if (
      !firstname ||
      !lastname ||
      !gender ||
      !department ||
      !faculty ||
      !level
    ) {
      return res.status(400).json({
        error: true,
        message: "All student information is required.",
      });
    }

    const allowedGenders = ["Male", "Female"];

    if (!allowedGenders.includes(gender)) {
      return res.status(400).json({
        error: true,
        message: "Invalid gender selected.",
      });
    }

    const [[facultyRow]] = await pool.query(
      `
      SELECT id
      FROM faculties
      WHERE name = ?
      `,
      [faculty]
    );

    if (!facultyRow) {
      return res.status(400).json({
        error: true,
        message: "Faculty not found.",
      });
    }

    const [[departmentRow]] = await pool.query(
      `
      SELECT id
      FROM departments
      WHERE name = ?
      `,
      [department]
    );

    if (!departmentRow) {
      return res.status(400).json({
        error: true,
        message: "Department not found.",
      });
    }

    const normalizedLevel = String(level)
      .trim()
      .replace(/\s*level\s*$/i, "");

    const [[levelRow]] = await pool.query(
      `
      SELECT id, name
      FROM levels
      WHERE LOWER(TRIM(name)) =
            LOWER(CONCAT(?, ' level'))
      LIMIT 1
      `,
      [normalizedLevel]
    );

    if (!levelRow) {
      return res.status(400).json({
        error: true,
        message: "Level not found.",
      });
    }

    const [result] = await pool.query(
      `
      UPDATE students
      SET
        firstname = ?,
        lastname = ?,
        gender = ?,
        department_id = ?,
        faculty_id = ?,
        level_id = ?
      WHERE id = ?
      `,
      [
        firstname.trim(),
        lastname.trim(),
        gender,
        departmentRow.id,
        facultyRow.id,
        levelRow.id,
        studentId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: true,
        message: "Student not found.",
      });
    }

    const [[student]] = await pool.query(
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
        l.name AS level

      FROM students s

      LEFT JOIN departments d
        ON s.department_id = d.id

      LEFT JOIN faculties f
        ON s.faculty_id = f.id

      LEFT JOIN levels l
        ON s.level_id = l.id

      WHERE s.id = ?
      `,
      [studentId]
    );

    return res.json({
      success: true,
      message: "Student information updated successfully.",
      student,
    });

  } catch (err) {

    console.error("UPDATE STUDENT ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to update student information.",
    });
  }

});

router.get("/lookups", studentMiddleware, async (req, res) => {
  try {
    const [faculties] = await pool.query(
      `
      SELECT id, name
      FROM faculties
      ORDER BY name ASC
      `
    );

    const [departments] = await pool.query(
      `
      SELECT id, name
      FROM departments
      ORDER BY name ASC
      `
    );

    const [levels] = await pool.query(
      `
      SELECT id, name
      FROM levels
      ORDER BY id ASC
      `
    );

    const [semesters] = await pool.query(
      `
      SELECT id, name
      FROM semesters
      ORDER BY id ASC
      `
    );

    res.json({
      faculties,
      departments,
      levels,
      semesters,
    });

  } catch (err) {
    console.error("LOAD LOOKUPS ERROR:", err);

    res.status(500).json({
      error: "Failed to load faculties, departments and levels.",
    });
  }
});

router.get("/courses", studentMiddleware, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Get the student's foreign keys
    const [[student]] = await pool.query(
      `
      SELECT
        id,
        department_id,
        faculty_id,
        level_id
      FROM students
      WHERE id = ?
      `,
      [studentId]
    );

    if (!student) {
      return res.status(404).json({
        error: true,
        message: "Student not found.",
      });
    }

    // Get the currently active semester
    const [[semester]] = await pool.query(
      `
      SELECT
        id,
        name
      FROM semesters
      WHERE is_current = 1
      LIMIT 1
      `
    );

    if (!semester) {
      return res.status(404).json({
        error: true,
        message: "No active semester has been set.",
      });
    }

    // Get courses matching the student's
    // department, level and current semester
    const [courses] = await pool.query(
      `
      SELECT
        c.id,
        c.course_code,
        c.course_title,
        c.course_unit,
        c.created_at,

        CASE
          WHEN cr.id IS NOT NULL THEN TRUE
          ELSE FALSE
        END AS registered

      FROM courses c

      LEFT JOIN course_registrations cr
        ON cr.course_id = c.id
        AND cr.student_id = ?
        AND cr.semester_id = ?

      WHERE c.department_id = ?
        AND c.level_id = ?
        AND c.semester_id = ?

      ORDER BY c.course_code ASC
      `,
      [
        studentId,
        semester.id,
        student.department_id,
        student.level_id,
        semester.id,
      ]
    );

    // Get names for the response
    const [[studentInfo]] = await pool.query(
      `
      SELECT
        d.name AS department,
        f.name AS faculty,
        l.name AS level
      FROM students s

      LEFT JOIN departments d
        ON s.department_id = d.id

      LEFT JOIN faculties f
        ON s.faculty_id = f.id

      LEFT JOIN levels l
        ON s.level_id = l.id

      WHERE s.id = ?
      `,
      [studentId]
    );

    return res.json({
      success: true,

      semester: semester.name,

      student: {
        faculty: studentInfo.faculty,
        department: studentInfo.department,
        level: studentInfo.level,
      },

      courses,
    });

  } catch (err) {
    console.error("GET STUDENT COURSES ERROR:", err);

    return res.status(500).json({
      error: true,
      message: err.message,
    });
  }
});

module.exports = router;