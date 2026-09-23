const pool = require("../db");

const getCurrentSemester = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, name, is_current
      FROM semesters
      WHERE is_current = TRUE
      LIMIT 1
      `
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: true,
        message: "No current semester has been set",
      });
    }

    return res.json({
      success: true,
      semester: rows[0],
    });
  } catch (err) {
    console.error("GET CURRENT SEMESTER ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch current semester",
    });
  }
};

const getDepartmentsByFaculty = async (req, res) => {
  const { facultyId } = req.params;

  if (!facultyId) {
    return res.status(400).json({
      error: true,
      message: "Faculty ID is required",
    });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        name,
        faculty_id
      FROM departments
      WHERE faculty_id = ?
      ORDER BY name ASC
      `,
      [facultyId]
    );

    return res.json({
      success: true,
      departments: rows,
    });
  } catch (err) {
    console.error(
      "GET DEPARTMENTS BY FACULTY ERROR:",
      err
    );

    return res.status(500).json({
      error: true,
      message: "Failed to fetch departments",
    });
  }
};

const getFaculties = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        name
      FROM faculties
      ORDER BY name ASC
      `
    );

    return res.json({
      success: true,
      faculties: rows,
    });
  } catch (err) {
    console.error("GET FACULTIES ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch faculties",
    });
  }
};

const getLevels = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        name
      FROM levels
      ORDER BY id ASC
      `
    );

    return res.json({
      success: true,
      levels: rows,
    });
  } catch (err) {
    console.error("GET LEVELS ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch levels",
    });
  }
};

const getAvailableCourses = async (req, res) => {
  const { faculty_id, department_id, level_id } = req.query;

  if (!faculty_id || !department_id || !level_id) {
    return res.status(400).json({
      error: true,
      message: "Faculty, department and level are required",
    });
  }

  try {
    // Get the current semester
    const [currentSemester] = await pool.query(
      `
      SELECT id, name
      FROM semesters
      WHERE is_current = TRUE
      LIMIT 1
      `
    );

    if (currentSemester.length === 0) {
      return res.status(404).json({
        error: true,
        message: "No current semester has been set",
      });
    }

    const semesterId = currentSemester[0].id;

    // Get courses matching the selected faculty,
    // department, level and current semester
    const lecturerId = req.user.id;
    const [courses] = await pool.query(
      `
      SELECT
        c.id,
        c.course_code,
        c.course_title,
        c.course_unit,
        c.department_id,
        c.level_id,
        c.semester_id,

        d.name AS department_name,
        f.id AS faculty_id,
        f.name AS faculty_name,
        l.name AS level_name,
        s.name AS semester_name

      FROM courses c

      INNER JOIN departments d
        ON c.department_id = d.id

      INNER JOIN faculties f
        ON d.faculty_id = f.id

      INNER JOIN levels l
        ON c.level_id = l.id

      INNER JOIN semesters s
        ON c.semester_id = s.id

      WHERE c.semester_id = ?
        AND c.department_id = ?
        AND c.level_id = ?
        AND d.faculty_id = ?

      AND NOT EXISTS (
        SELECT 1
        FROM lecturer_course_registrations lcr
        WHERE lcr.lecturer_id = ?
          AND lcr.semester_id = c.semester_id
          AND lcr.course_id = c.id
      )

      ORDER BY c.course_code ASC
      `,
      [
        semesterId,
        department_id,
        level_id,
        faculty_id,
        lecturerId
      ]
    );

    return res.json({
      success: true,
      semester: currentSemester[0],
      courses,
    });
  } catch (err) {
    console.error("GET AVAILABLE COURSES ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch available courses",
    });
  }
};

const registerCourses = async (req, res) => {
  const lecturerId = req.user.id;

  const {
    faculty_id,
    department_id,
    level_id,
    course_ids,
  } = req.body;

  // Validate required fields
  if (!faculty_id || !department_id || !level_id) {
    return res.status(400).json({
      error: true,
      message: "Faculty, department and level are required",
    });
  }

  // Validate course_ids
  if (
    !Array.isArray(course_ids) ||
    course_ids.length === 0
  ) {
    return res.status(400).json({
      error: true,
      message: "Please select at least one course",
    });
  }

  // Remove duplicate IDs from the request itself
  const uniqueCourseIds = [
    ...new Set(course_ids.map(Number)),
  ];

  try {
    /*
     * 1. Get current semester
     */
    const [currentSemester] = await pool.query(
      `
      SELECT id, name
      FROM semesters
      WHERE is_current = TRUE
      LIMIT 1
      `
    );

    if (currentSemester.length === 0) {
      return res.status(400).json({
        error: true,
        message: "No current semester has been set",
      });
    }

    const semesterId = currentSemester[0].id;

    /*
     * 2. Verify department belongs to faculty
     */
    const [department] = await pool.query(
      `
      SELECT id
      FROM departments
      WHERE id = ?
        AND faculty_id = ?
      LIMIT 1
      `,
      [department_id, faculty_id]
    );

    if (department.length === 0) {
      return res.status(400).json({
        error: true,
        message:
          "The selected department does not belong to the selected faculty",
      });
    }

    /*
     * 3. Verify all selected courses
     */
    const [courses] = await pool.query(
      `
      SELECT
        c.id,
        c.course_code,
        c.course_title,
        c.course_unit

      FROM courses c

      INNER JOIN departments d
        ON c.department_id = d.id

      WHERE c.id IN (?)
        AND c.semester_id = ?
        AND c.department_id = ?
        AND c.level_id = ?
        AND d.faculty_id = ?
      `,
      [
        uniqueCourseIds,
        semesterId,
        department_id,
        level_id,
        faculty_id,
      ]
    );

    /*
     * Make sure all selected courses are valid
     */
    if (courses.length !== uniqueCourseIds.length) {
      return res.status(400).json({
        error: true,
        message:
          "One or more selected courses are not valid for the selected faculty, department, level or current semester",
      });
    }

    /*
     * 4. Check which courses are already registered
     */
    const [existingRegistrations] = await pool.query(
      `
      SELECT
        lcr.course_id,
        c.course_code,
        c.course_title

      FROM lecturer_course_registrations lcr

      INNER JOIN courses c
        ON lcr.course_id = c.id

      WHERE lcr.lecturer_id = ?
        AND lcr.semester_id = ?
        AND lcr.course_id IN (?)
      `,
      [
        lecturerId,
        semesterId,
        uniqueCourseIds,
      ]
    );

    const existingCourseIds = new Set(
      existingRegistrations.map(
        (course) => Number(course.course_id)
      )
    );

    /*
     * 5. Keep only courses that haven't
     *    already been registered
     */
    const coursesToRegister = courses.filter(
      (course) =>
        !existingCourseIds.has(Number(course.id))
    );

    /*
     * 6. Register new courses
     */
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const course of coursesToRegister) {
        await connection.query(
          `
          INSERT INTO lecturer_course_registrations (
            lecturer_id,
            semester_id,
            faculty_id,
            department_id,
            level_id,
            course_id
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            lecturerId,
            semesterId,
            faculty_id,
            department_id,
            level_id,
            course.id,
          ]
        );
      }

      await connection.commit();

      /*
       * Courses that were already registered
       */
      const alreadyRegistered = courses.filter(
        (course) =>
          existingCourseIds.has(Number(course.id))
      );

      return res.status(201).json({
        success: true,
        message:
          coursesToRegister.length > 0
            ? "Courses registered successfully"
            : "All selected courses are already registered",

        semester: currentSemester[0],

        registeredCourses: coursesToRegister,

        alreadyRegistered,

      });

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error(
      "REGISTER COURSES ERROR:",
      err
    );

    return res.status(500).json({
      error: true,
      message: "Failed to register courses",
    });
  }
};

const getMyCourses = async (req, res) => {
  const lecturerId = req.user.id;

  try {
    /*
     * 1. Get current semester
     */
    const [currentSemester] = await pool.query(
      `
      SELECT
        id,
        name,
        is_current
      FROM semesters
      WHERE is_current = TRUE
      LIMIT 1
      `
    );

    if (currentSemester.length === 0) {
      return res.status(404).json({
        error: true,
        message: "No current semester has been set",
      });
    }

    const semesterId = currentSemester[0].id;

    /*
     * 2. Get courses registered by this lecturer
     *    for the current semester
     */
    const [courses] = await pool.query(
      `
      SELECT
        lcr.id AS registration_id,

        c.id AS course_id,
        c.course_code,
        c.course_title,
        c.course_unit,

        f.id AS faculty_id,
        f.name AS faculty_name,

        d.id AS department_id,
        d.name AS department_name,

        l.id AS level_id,
        l.name AS level_name,

        s.id AS semester_id,
        s.name AS semester_name,

        lcr.created_at AS registered_at

      FROM lecturer_course_registrations lcr

      INNER JOIN courses c
        ON lcr.course_id = c.id

      INNER JOIN faculties f
        ON lcr.faculty_id = f.id

      INNER JOIN departments d
        ON lcr.department_id = d.id

      INNER JOIN levels l
        ON lcr.level_id = l.id

      INNER JOIN semesters s
        ON lcr.semester_id = s.id

      WHERE lcr.lecturer_id = ?
        AND lcr.semester_id = ?

      ORDER BY c.course_code ASC
      `,
      [lecturerId, semesterId]
    );

    return res.json({
      success: true,

      semester: currentSemester[0],

      courses,
    });

  } catch (err) {
    console.error("GET MY COURSES ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch registered courses",
    });
  }
};

const removeCourseRegistration = async (req, res) => {
  const lecturerId = req.user.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      error: true,
      message: "Registration ID is required",
    });
  }

  try {
    // Make sure this registration belongs
    // to the logged-in lecturer
    const [registration] = await pool.query(
      `
      SELECT
        lcr.id,
        c.course_code,
        c.course_title
      FROM lecturer_course_registrations lcr
      INNER JOIN courses c
        ON lcr.course_id = c.id
      WHERE lcr.id = ?
        AND lcr.lecturer_id = ?
      LIMIT 1
      `,
      [id, lecturerId]
    );

    if (registration.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Course registration not found",
      });
    }

    // Delete registration
    await pool.query(
      `
      DELETE FROM lecturer_course_registrations
      WHERE id = ?
        AND lecturer_id = ?
      `,
      [id, lecturerId]
    );

    return res.json({
      success: true,
      message: "Course removed successfully",
      registration: registration[0],
    });
  } catch (err) {
    console.error(
      "REMOVE COURSE REGISTRATION ERROR:",
      err
    );

    return res.status(500).json({
      error: true,
      message: "Failed to remove course",
    });
  }
};

module.exports = {
  getCurrentSemester,
  getDepartmentsByFaculty,
  getFaculties,
  getLevels,
  getAvailableCourses,
  registerCourses,
  getMyCourses,
  removeCourseRegistration
};