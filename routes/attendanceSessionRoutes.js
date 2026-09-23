const express = require("express");
const router = express.Router();
const pool = require("../db");

const {
    startAttendance,
    closeAttendance,
    getActiveAttendance,
} = require("../controllers/attendanceSessionControllers");

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const createIndexIfNotExists = async (indexName, columnName) => {
    const [indexes] = await pool.query(
        `
        SHOW INDEX
        FROM attendance_sessions
        WHERE Key_name = ?
        `,
        [indexName]
    );

    if (indexes.length === 0) {
        await pool.query(`
            CREATE INDEX ${indexName}
            ON attendance_sessions (${columnName})
        `);
    }
};

const initAttendanceSessionTable = async () => {
    try {
        const createAttendanceSessionTable = `
            CREATE TABLE IF NOT EXISTS attendance_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                
                lecturer_id INT NOT NULL,
                course_id INT NOT NULL,
                semester_id INT NOT NULL,
                
                session_code VARCHAR(6) NOT NULL,
                
                started_at DATETIME NOT NULL,
                expires_at DATETIME NOT NULL,
                
                status ENUM('Active', 'Closed', 'Expired')
                NOT NULL DEFAULT 'Active',
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (lecturer_id)
                REFERENCES lecturers(id)
                ON DELETE CASCADE,
                
                FOREIGN KEY (course_id)
                REFERENCES courses(id)
                ON DELETE CASCADE,
                
                FOREIGN KEY (semester_id)
                REFERENCES semesters(id)
                ON DELETE RESTRICT
            )
        `;

    await pool.query(createAttendanceSessionTable);
    await createIndexIfNotExists(
        "idx_attendance_sessions_lecturer",
        "lecturer_id"
    );

    await createIndexIfNotExists(
        "idx_attendance_sessions_course",
        "course_id"
    );

    await createIndexIfNotExists(
        "idx_attendance_sessions_status",
        "status"
    );

    console.log("✅ Attendance session table ready");
  } catch (err) {
    console.error("❌ Error creating attendance session table:", err);
  }
};

initAttendanceSessionTable();

router.post("/start", authMiddleware, requireRole("lecturer"), startAttendance);

router.post("/close/:sessionId", authMiddleware, requireRole("lecturer"), closeAttendance);

router.get("/active", authMiddleware, requireRole("lecturer"), getActiveAttendance);

module.exports = router;