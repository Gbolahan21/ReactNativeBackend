const express = require("express");

const pool = require("../db");

const studentMiddleware = require("../middleware/studentMiddleware");

const router = express.Router();

router.post(
  "/:courseId/register",
  studentMiddleware,
  async (req, res) => {
    try {
      const studentId = req.student.id;
      const courseId = Number(req.params.courseId);

      if (!courseId || Number.isNaN(courseId)) {
        return res.status(400).json({
          error: true,
          message: "Invalid course.",
        });
      }

      // Get current semester
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
          error: true,
          message: "No active semester has been set.",
        });
      }

      // Make sure the course belongs to the
      // student's department and level
      const [[course]] = await pool.query(
        `
        SELECT
          c.id,
          c.course_code,
          c.course_title
        FROM courses c

        INNER JOIN students s
          ON s.department_id = c.department_id
          AND s.level_id = c.level_id

        WHERE c.id = ?
          AND s.id = ?
          AND c.semester_id = ?
        `,
        [
          courseId,
          studentId,
          semester.id,
        ]
      );

      if (!course) {
        return res.status(400).json({
          error: true,
          message: "This course is not available for you.",
        });
      }

      // Register course
      await pool.query(
        `
        INSERT INTO course_registrations
          (
            student_id,
            course_id,
            semester_id
          )
        VALUES (?, ?, ?)
        `,
        [
          studentId,
          courseId,
          semester.id,
        ]
      );

      return res.status(201).json({
        success: true,
        message: `${course.course_code} registered successfully.`,
      });

    } catch (err) {

      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({
          error: true,
          message: "You have already registered this course.",
        });
      }

      console.error(
        "REGISTER COURSE ERROR:",
        err
      );

      return res.status(500).json({
        error: true,
        message: "Failed to register course.",
      });
    }
  }
);

router.delete(
  "/:courseId/drop",
  studentMiddleware,
  async (req, res) => {
    try {
      const studentId = req.student.id;
      const courseId = Number(req.params.courseId);

      if (!courseId || Number.isNaN(courseId)) {
        return res.status(400).json({
          error: true,
          message: "Invalid course.",
        });
      }

      // Get current semester
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
          error: true,
          message: "No active semester has been set.",
        });
      }

      const [result] = await pool.query(
        `
        DELETE FROM course_registrations
        WHERE student_id = ?
          AND course_id = ?
          AND semester_id = ?
        `,
        [
          studentId,
          courseId,
          semester.id,
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: true,
          message: "Course registration not found.",
        });
      }

      return res.json({
        success: true,
        message: "Course dropped successfully.",
      });

    } catch (err) {

      console.error(
        "DROP COURSE ERROR:",
        err
      );

      return res.status(500).json({
        error: true,
        message: "Failed to drop course.",
      });
    }
  }
);

router.post(
  "/register-all",
  studentMiddleware,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const studentId = req.student.id;

      await connection.beginTransaction();

      // Get student department and level
      const [[student]] = await connection.query(
        `
        SELECT
          id,
          department_id,
          level_id
        FROM students
        WHERE id = ?
        `,
        [studentId]
      );

      if (!student) {
        await connection.rollback();

        return res.status(404).json({
          error: true,
          message: "Student not found.",
        });
      }

      // Get current semester
      const [[semester]] = await connection.query(
        `
        SELECT id, name
        FROM semesters
        WHERE is_current = 1
        LIMIT 1
        `
      );

      if (!semester) {
        await connection.rollback();

        return res.status(400).json({
          error: true,
          message: "No active semester has been set.",
        });
      }

      // Get all courses available to student
      const [courses] = await connection.query(
        `
        SELECT id
        FROM courses
        WHERE department_id = ?
          AND level_id = ?
          AND semester_id = ?
        `,
        [
          student.department_id,
          student.level_id,
          semester.id,
        ]
      );

      if (courses.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          error: true,
          message: "No courses are available for you this semester.",
        });
      }

      // Prepare registrations
      const values = courses.map((course) => [
        studentId,
        course.id,
        semester.id,
      ]);

      // Register all courses
      await connection.query(
        `
        INSERT IGNORE INTO course_registrations
          (
            student_id,
            course_id,
            semester_id
          )
        VALUES ?
        `,
        [values]
      );

      await connection.commit();

      return res.json({
        success: true,
        message: "All available courses registered successfully.",
        registeredCount: courses.length,
      });

    } catch (err) {

      await connection.rollback();

      console.error(
        "REGISTER ALL COURSES ERROR:",
        err
      );

      return res.status(500).json({
        error: true,
        message: "Failed to register all courses.",
      });

    } finally {
      connection.release();
    }
  }
);

module.exports = router;