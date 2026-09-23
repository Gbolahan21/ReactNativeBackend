const pool = require("../db");

const generateSessionCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const startAttendance = async (req, res) => {
    try {
        const lecturerId = req.user.id;

        const {
            course_id,
            duration = 10,
        } = req.body;

        if (!course_id) {
            return res.status(400).json({
                success: false,
                message: "Course is required.",
            });
        }

        const [[semester]] = await pool.query(`
            SELECT id, name
            FROM semesters
            WHERE is_current = 1
            LIMIT 1
        `);

        if (!semester) {
            return res.status(400).json({
                success: false,
                message: "There is no active semester.",
            });
        }

        const [[registration]] = await pool.query(
            `
            SELECT
                lcr.id,
                lcr.course_id,
                c.course_code,
                c.course_title
            FROM lecturer_course_registrations lcr
            INNER JOIN courses c
                ON c.id = lcr.course_id
            WHERE lcr.lecturer_id = ?
              AND lcr.course_id = ?
              AND lcr.semester_id = ?
            LIMIT 1
            `,
            [
                lecturerId,
                course_id,
                semester.id,
            ]
        );

        if (!registration) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not registered to teach this course.",
            });
        }

        const [[activeSession]] = await pool.query(
            `
            SELECT id
            FROM attendance_sessions
            WHERE lecturer_id = ?
              AND course_id = ?
              AND semester_id = ?
              AND status = 'Active'
              AND expires_at > NOW()
            LIMIT 1
            `,
            [
                lecturerId,
                course_id,
                semester.id,
            ]
        );

        if (activeSession) {
            return res.status(409).json({
                success: false,
                message:
                    "Attendance is already active for this course.",
                session_id: activeSession.id,
            });
        }

        const sessionCode = generateSessionCode();

        const safeDuration = Math.min(
            Math.max(Number(duration), 1),
            30
        );

        const [result] = await pool.query(
            `
            INSERT INTO attendance_sessions (
                lecturer_id,
                course_id,
                semester_id,
                session_code,
                started_at,
                expires_at,
                status
            )
            VALUES (
                ?,
                ?,
                ?,
                ?,
                NOW(),
                DATE_ADD(
                    NOW(),
                    INTERVAL ? MINUTE
                ),
                'Active'
            )
            `,
            [
                lecturerId,
                course_id,
                semester.id,
                sessionCode,
                safeDuration,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Attendance started successfully.",
            session: {
                id: result.insertId,
                course_id: registration.course_id,
                course_code: registration.course_code,
                course_title: registration.course_title,
                semester_id: semester.id,
                semester_name: semester.name,
                session_code: sessionCode,
                duration: safeDuration,
            },
        });

    } catch (error) {
        console.error(
            "START ATTENDANCE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to start attendance.",
        });
    }
};

const closeAttendance = async (req, res) => {
    try {
        const lecturerId = req.user.id;
        const { sessionId } = req.params;

        const [result] = await pool.query(
            `
            UPDATE attendance_sessions
            SET status = 'Closed'
            WHERE id = ?
              AND lecturer_id = ?
              AND status = 'Active'
            `,
            [
                sessionId,
                lecturerId,
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Attendance session not found or already closed.",
            });
        }

        return res.json({
            success: true,
            message: "Attendance closed successfully.",
        });

    } catch (error) {
        console.error(
            "CLOSE ATTENDANCE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to close attendance.",
        });
    }
};

const getActiveAttendance = async (req, res) => {
    try {
        const lecturerId = req.user.id;

        const [sessions] = await pool.query(
            `
            SELECT
                a.id,
                a.course_id,
                c.course_code,
                c.course_title,
                a.session_code,
                a.started_at,
                a.expires_at,
                a.status,

                COUNT(att.id) AS present_count

            FROM attendance_sessions a
            INNER JOIN courses c
                ON c.id = a.course_id
            LEFT JOIN attendance att
                ON att.course_id = a.course_id
                AND att.attendance_date = CURDATE()
                AND att.status = 'Present'
            WHERE a.lecturer_id = ?
              AND a.status = 'Active'
              AND a.expires_at > NOW()
            GROUP BY
                a.id,
                a.course_id,
                c.course_code,
                c.course_title,
                a.session_code,
                a.started_at,
                a.expires_at,
                a.status
            ORDER BY a.started_at DESC
            `,
            [lecturerId]
        );

        return res.json({
            success: true,
            sessions,
        });

    } catch (error) {
        console.error(
            "GET ACTIVE ATTENDANCE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch active attendance.",
        });
    }
};


module.exports = {
    startAttendance,
    closeAttendance,
    getActiveAttendance,
};