const express = require("express");
const pool = require("../db");

const router = express.Router();
const studentMiddleware = require("../middleware/studentMiddleware");

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

router.post("/checkin", studentMiddleware, async (req, res) => {
  const studentId = req.student.id;
  const { courseId, sessionCode } = req.body;

  if (!courseId || !sessionCode) {
    return res.status(400).json({
      error: "Course and attendance code are required.",
    });
  }

  try {
    const [[semester]] = await pool.query(
      `
      SELECT id, name
      FROM semesters
      WHERE is_current = 1
      LIMIT 1
      `
    );

    if (!semester) {
      return res.status(400).json({
        error: "No active semester has been set.",
      });
    }

    const [[registration]] = await pool.query(
      `
      SELECT
        cr.id,
        cr.course_id,
        cr.semester_id
      FROM course_registrations cr
      WHERE cr.student_id = ?
        AND cr.course_id = ?
        AND cr.semester_id = ?
      LIMIT 1
      `,
      [
        studentId,
        courseId,
        semester.id,
      ]
    );

    if (!registration) {
      return res.status(403).json({
        error: "You are not registered for this course.",
      });
    }

    const [[session]] = await pool.query(
      `
      SELECT
        id,
        lecturer_id,
        course_id,
        semester_id,
        session_code,
        started_at,
        expires_at,
        status
      FROM attendance_sessions
      WHERE course_id = ?
        AND semester_id = ?
        AND session_code = ?
        AND status = 'Active'
        AND started_at <= NOW()
        AND expires_at > NOW()
      ORDER BY started_at DESC
      LIMIT 1
      `,
      [
        courseId,
        semester.id,
        sessionCode,
      ]
    );

    if (!session) {
      return res.status(400).json({
        error: "Invalid or expired attendance code.",
      });
    }

    const [[existing]] = await pool.query(
      `
      SELECT id
      FROM attendance
      WHERE student_id = ?
        AND course_id = ?
        AND attendance_date = CURDATE()
      LIMIT 1
      `,
      [
        studentId,
        courseId,
      ]
    );

    if (existing) {
      return res.status(400).json({
        error:
          "Attendance has already been recorded for this course today.",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO attendance (
        student_id,
        course_id,
        attendance_date,
        check_in,
        status
      )
      VALUES (
        ?,
        ?,
        CURDATE(),
        CURTIME(),
        ?
      )
      `,
      [
        studentId,
        courseId,
        "Present",
      ]
    );

    const [[attendance]] = await pool.query(
      `
      SELECT
        a.id,
        a.student_id,
        a.course_id,
        c.course_code,
        c.course_title,
        a.attendance_date,
        a.check_in,
        a.check_out,
        a.status
      FROM attendance a
      JOIN courses c
        ON a.course_id = c.id
      WHERE a.id = ?
      `,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Attendance recorded successfully.",
      attendance,
    });

  } catch (err) {
    console.error("CHECK-IN ERROR:", err);

    return res.status(500).json({
      error: "Failed to record attendance.",
    });
  }
});

router.post("/checkout", studentMiddleware, async (req, res) => {
  const studentId = req.student.id;
  const { courseId } = req.body;

  if (!courseId) {
    return res.status(400).json({
      error: "Course is required.",
    });
  }

  try {
    const [[attendance]] = await pool.query(
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
        AND course_id = ?
        AND attendance_date = CURDATE()
      LIMIT 1
      `,
      [
        studentId,
        courseId,
      ]
    );

    if (!attendance) {
      return res.status(400).json({
        error: "You have not checked in for this course today.",
      });
    }

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
      `
      UPDATE attendance
      SET check_out = CURTIME()
      WHERE id = ?
      `,
      [attendance.id]
    );

    const [[updatedAttendance]] = await pool.query(
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
      WHERE id = ?
      `,
      [attendance.id]
    );

    return res.json({
      success: true,
      message: "Checkout recorded successfully.",
      attendance: updatedAttendance,
    });

  } catch (err) {
    console.error("CHECKOUT ERROR:", err);

    return res.status(500).json({
      error: "Failed to record checkout.",
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