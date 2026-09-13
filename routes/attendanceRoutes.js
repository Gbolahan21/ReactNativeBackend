const express = require("express");
const pool = require("../db");

const router = express.Router();


const initAttendanceTable = async () => {
  try {
    const createAttendanceTable = `
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        attendance_date DATE NOT NULL,
        check_in TIME,
        check_out TIME,
        status VARCHAR(20),
        FOREIGN KEY (student_id) REFERENCES students(id)
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
  const { studentId } = req.body;

  try {
    const [existing] = await pool.query(
      `SELECT * FROM attendance
        WHERE student_id = ?
        AND attendance_date = CURDATE()`,
      [studentId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: "Attendance has already been recorded today."
      });
    }

    await pool.query(
      `INSERT INTO attendance
      (student_id, attendance_date, check_in, status)
      VALUES (?, CURDATE(), CURTIME(), ?)`,
      [studentId, "Present"]
    );

    res.json({
      message: "Attendance recorded successfully."
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

router.post("/checkout", async (req, res) => {
  const { studentId } = req.body;

  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM attendance
       WHERE student_id = ?
       AND attendance_date = CURDATE()`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        error: "You have not checked in today.",
      });
    }

    const attendance = rows[0];

    if (attendance.check_out) {
      return res.status(400).json({
        error: "You have already checked out today.",
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
              attendance_date,
              check_in,
              check_out,
              status
          FROM attendance
          WHERE student_id = ?
          AND attendance_date = CURDATE()
          `,
          [studentId]
      );

      if (rows.length === 0) {
          return res.json({
              status: "Not Recorded"
          });
      }

      res.json(rows[0]);

  } catch (err) {
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
              id,
              attendance_date,
              check_in,
              check_out,
              status
          FROM attendance
          WHERE student_id = ?
          ORDER BY attendance_date DESC
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


module.exports = router;