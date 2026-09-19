const express = require("express");
const pool = require("../db");

const router = express.Router();


const initAttendanceTable = async () => {
  try {
    const createAttendanceTable = `
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,

        student_id INT NOT NULL,
        course_id INT NOT NULL,

        attendance_date DATE NOT NULL,
        check_in TIME,
        check_out TIME,
        status VARCHAR(20),

        FOREIGN KEY (student_id)
          REFERENCES students(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        FOREIGN KEY (course_id)
          REFERENCES courses(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT
      )
    `;

    await pool.query(createAttendanceTable);
    console.log("✅ Attendance table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
};

initAttendanceTable();

router.post("/checkin", async (req, res) => {
  const { studentId, courseId } = req.body;

  if (!studentId || !courseId) {
    return res.status(400).json({
      error: "Student and course are required.",
    });
  }

  try {
    const [existing] = await pool.query(
      `SELECT *
       FROM attendance
       WHERE student_id = ?
       AND course_id = ?
       AND attendance_date = CURDATE()`,
      [studentId, courseId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: "Attendance has already been recorded for this course today.",
      });
    }

    await pool.query(
      `INSERT INTO attendance
       (student_id, course_id, attendance_date, check_in, status)
       VALUES (?, ?, CURDATE(), CURTIME(), ?)`,
      [studentId, courseId, "Present"]
    );

    res.json({
      message: "Attendance recorded successfully.",
    });

  } catch (err) {
    console.error("Check-in error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

router.post("/checkout", async (req, res) => {
  const { studentId, courseId } = req.body;

  if (!studentId || !courseId) {
    return res.status(400).json({
      error: "Student and course are required.",
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM attendance
       WHERE student_id = ?
       AND course_id = ?
       AND attendance_date = CURDATE()`,
      [studentId, courseId]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        error: "You have not checked in for this course today.",
      });
    }

    const attendance = rows[0];

    if (!attendance.check_in) {
      return res.status(400).json({
        error: "You have not checked in for this course.",
      });
    }

    if (attendance.check_out) {
      return res.status(400).json({
        error: "You have already checked out from this course today.",
      });
    }

    await pool.query(
      `UPDATE attendance
       SET check_out = CURTIME()
       WHERE id = ?`,
      [attendance.id]
    );

    const [updatedAttendance] = await pool.query(
      `SELECT
        id,
        student_id,
        course_id,
        attendance_date,
        check_in,
        check_out,
        status
       FROM attendance
       WHERE id = ?`,
      [attendance.id]
    );

    res.json({
      message: "Checkout recorded successfully.",
      attendance: updatedAttendance[0],
    });

  } catch (err) {
    console.error("Checkout error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

router.get("/today/:studentId", async (req, res) => {
  const { studentId } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        student_id,
        course_id,
        attendance_date,
        check_in,
        check_out,
        status
      FROM attendance
      WHERE student_id = ?
      AND attendance_date = CURDATE()
      ORDER BY id DESC
      `,
      [studentId]
    );

    res.json(rows);

  } catch (err) {
    console.error("Today's attendance error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

router.get("/history/:studentId", async (req, res) => {
  const { studentId } = req.params;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
      // Get paginated attendance records
      const [rows] = await pool.query(
          `
          SELECT
            a.id,
            a.course_id,
            c.course_code,
            c.course_title,
            c.course_unit,
            a.attendance_date,
            a.check_in,
            a.check_out,
            a.status
          FROM attendance a
          JOIN courses c
              ON a.course_id = c.id
          WHERE a.student_id = ?
          ORDER BY a.attendance_date DESC
          LIMIT ? OFFSET ?
          `,
          [studentId, limit, offset]
      );

      // Get total number of records
      const [countResult] = await pool.query(
          `
          SELECT COUNT(*) AS total
          FROM attendance
          WHERE student_id = ?
          `,
          [studentId]
      );

      const totalRecords = countResult[0].total;
      const totalPages = Math.ceil(totalRecords / limit);

      res.json({
          records: rows,
          page,
          limit,
          totalRecords,
          totalPages,
      });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

router.get("/admin", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.id,
        s.matricNo,

        a.course_id,
        c.course_code,
        c.course_title,
        c.course_unit,

        s.level_id,
        l.name AS level_name,

        a.attendance_date,
        a.check_in,
        a.check_out,
        a.status

      FROM attendance a

      JOIN students s
        ON a.student_id = s.id

      JOIN courses c
        ON a.course_id = c.id

      JOIN levels l
        ON s.level_id = l.id

      ORDER BY a.attendance_date DESC, a.check_in DESC
    `);

    res.json({
      attendance: rows,
    });

  } catch (err) {
    console.error("Admin attendance error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;