const pool = require("../db");

// CREATE COURSE
const createCourse = async (req, res) => {
  const {
    course_code,
    course_title,
    department_id,
    level_id,
    semester_id,
  } = req.body;

  // Validate required fields
  if (!course_code || !course_code.trim()) {
    return res.status(400).json({
      error: true,
      message: "Course code is required",
    });
  }

  if (!course_title || !course_title.trim()) {
    return res.status(400).json({
      error: true,
      message: "Course title is required",
    });
  }

  if (!department_id) {
    return res.status(400).json({
      error: true,
      message: "Department is required",
    });
  }

  if (!level_id) {
    return res.status(400).json({
      error: true,
      message: "Level is required",
    });
  }

  if (!semester_id) {
    return res.status(400).json({
      error: true,
      message: "Semester is required",
    });
  }

  const courseCode = course_code.trim().toUpperCase();
  const courseTitle = course_title.trim();

  try {
    // Check department
    const [department] = await pool.query(
      `SELECT id
       FROM departments
       WHERE id = ?`,
      [department_id]
    );

    if (department.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Department not found",
      });
    }

    // Check level
    const [level] = await pool.query(
      `SELECT id
       FROM levels
       WHERE id = ?`,
      [level_id]
    );

    if (level.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Level not found",
      });
    }

    // Check semester
    const [semester] = await pool.query(
      `SELECT id
       FROM semesters
       WHERE id = ?`,
      [semester_id]
    );

    if (semester.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Semester not found",
      });
    }

    // Check duplicate course
    const [existingCourse] = await pool.query(
      `SELECT id
       FROM courses
       WHERE course_code = ?
       AND department_id = ?
       AND level_id = ?
       AND semester_id = ?`,
      [
        courseCode,
        department_id,
        level_id,
        semester_id,
      ]
    );

    if (existingCourse.length > 0) {
      return res.status(400).json({
        error: true,
        message:
          "This course already exists for this department, level and semester",
      });
    }

    // Create course
    const [result] = await pool.query(
      `INSERT INTO courses
       (
         course_code,
         course_title,
         department_id,
         level_id,
         semester_id
       )
       VALUES (?, ?, ?, ?, ?)`,
      [
        courseCode,
        courseTitle,
        department_id,
        level_id,
        semester_id,
      ]
    );

    // Return created course with related names
    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.course_code,
        c.course_title,
        c.department_id,
        d.name AS department_name,
        d.faculty_id,
        f.name AS faculty_name,
        c.level_id,
        l.name AS level_name,
        c.semester_id,
        s.name AS semester_name,
        c.created_at
       FROM courses c
       JOIN departments d
         ON c.department_id = d.id
       JOIN faculties f
         ON d.faculty_id = f.id
       JOIN levels l
         ON c.level_id = l.id
       JOIN semesters s
         ON c.semester_id = s.id
       WHERE c.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      course: rows[0],
    });
  } catch (err) {
    console.error("CREATE COURSE ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to create course",
    });
  }
};


// GET ALL COURSES
const getCourses = async (req, res) => {
  const {
    department_id,
    level_id,
    semester_id,
  } = req.query;

  try {
    let query = `
      SELECT
        c.id,
        c.course_code,
        c.course_title,
        c.department_id,
        d.name AS department_name,
        d.faculty_id,
        f.name AS faculty_name,
        c.level_id,
        l.name AS level_name,
        c.semester_id,
        s.name AS semester_name,
        c.created_at
      FROM courses c
      JOIN departments d
        ON c.department_id = d.id
      JOIN faculties f
        ON d.faculty_id = f.id
      JOIN levels l
        ON c.level_id = l.id
      JOIN semesters s
        ON c.semester_id = s.id
      WHERE 1 = 1
    `;

    const params = [];

    // Filter by department
    if (department_id) {
      query += ` AND c.department_id = ?`;
      params.push(department_id);
    }

    // Filter by level
    if (level_id) {
      query += ` AND c.level_id = ?`;
      params.push(level_id);
    }

    // Filter by semester
    if (semester_id) {
      query += ` AND c.semester_id = ?`;
      params.push(semester_id);
    }

    query += `
      ORDER BY c.course_code ASC
    `;

    const [rows] = await pool.query(query, params);

    return res.json({
      success: true,
      courses: rows,
    });
  } catch (err) {
    console.error("GET COURSES ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch courses",
    });
  }
};


// GET COURSE BY ID
const getCourseById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.course_code,
        c.course_title,
        c.department_id,
        d.name AS department_name,
        d.faculty_id,
        f.name AS faculty_name,
        c.level_id,
        l.name AS level_name,
        c.semester_id,
        s.name AS semester_name,
        c.created_at
       FROM courses c
       JOIN departments d
         ON c.department_id = d.id
       JOIN faculties f
         ON d.faculty_id = f.id
       JOIN levels l
         ON c.level_id = l.id
       JOIN semesters s
         ON c.semester_id = s.id
       WHERE c.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Course not found",
      });
    }

    return res.json({
      success: true,
      course: rows[0],
    });
  } catch (err) {
    console.error("GET COURSE ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch course",
    });
  }
};


// UPDATE COURSE
const updateCourse = async (req, res) => {
  const { id } = req.params;

  const {
    course_code,
    course_title,
    department_id,
    level_id,
    semester_id,
  } = req.body;

  // Validate
  if (!course_code || !course_code.trim()) {
    return res.status(400).json({
      error: true,
      message: "Course code is required",
    });
  }

  if (!course_title || !course_title.trim()) {
    return res.status(400).json({
      error: true,
      message: "Course title is required",
    });
  }

  if (!department_id) {
    return res.status(400).json({
      error: true,
      message: "Department is required",
    });
  }

  if (!level_id) {
    return res.status(400).json({
      error: true,
      message: "Level is required",
    });
  }

  if (!semester_id) {
    return res.status(400).json({
      error: true,
      message: "Semester is required",
    });
  }

  const courseCode = course_code.trim().toUpperCase();
  const courseTitle = course_title.trim();

  try {
    // Check course exists
    const [existingCourse] = await pool.query(
      `SELECT id
       FROM courses
       WHERE id = ?`,
      [id]
    );

    if (existingCourse.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Course not found",
      });
    }

    // Check department
    const [department] = await pool.query(
      `SELECT id
       FROM departments
       WHERE id = ?`,
      [department_id]
    );

    if (department.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Department not found",
      });
    }

    // Check level
    const [level] = await pool.query(
      `SELECT id
       FROM levels
       WHERE id = ?`,
      [level_id]
    );

    if (level.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Level not found",
      });
    }

    // Check semester
    const [semester] = await pool.query(
      `SELECT id
       FROM semesters
       WHERE id = ?`,
      [semester_id]
    );

    if (semester.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Semester not found",
      });
    }

    // Check duplicate
    const [duplicateCourse] = await pool.query(
      `SELECT id
       FROM courses
       WHERE course_code = ?
       AND department_id = ?
       AND level_id = ?
       AND semester_id = ?
       AND id != ?`,
      [
        courseCode,
        department_id,
        level_id,
        semester_id,
        id,
      ]
    );

    if (duplicateCourse.length > 0) {
      return res.status(400).json({
        error: true,
        message:
          "Another course with this combination already exists",
      });
    }

    // Update
    await pool.query(
      `UPDATE courses
       SET
         course_code = ?,
         course_title = ?,
         department_id = ?,
         level_id = ?,
         semester_id = ?
       WHERE id = ?`,
      [
        courseCode,
        courseTitle,
        department_id,
        level_id,
        semester_id,
        id,
      ]
    );

    // Return updated course
    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.course_code,
        c.course_title,
        c.department_id,
        d.name AS department_name,
        d.faculty_id,
        f.name AS faculty_name,
        c.level_id,
        l.name AS level_name,
        c.semester_id,
        s.name AS semester_name,
        c.created_at
       FROM courses c
       JOIN departments d
         ON c.department_id = d.id
       JOIN faculties f
         ON d.faculty_id = f.id
       JOIN levels l
         ON c.level_id = l.id
       JOIN semesters s
         ON c.semester_id = s.id
       WHERE c.id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: "Course updated successfully",
      course: rows[0],
    });
  } catch (err) {
    console.error("UPDATE COURSE ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to update course",
    });
  }
};


// DELETE COURSE
const deleteCourse = async (req, res) => {
  const { id } = req.params;

  try {
    // Check course exists
    const [existingCourse] = await pool.query(
      `SELECT id
       FROM courses
       WHERE id = ?`,
      [id]
    );

    if (existingCourse.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Course not found",
      });
    }

    await pool.query(
      `DELETE FROM courses
       WHERE id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: "Course deleted successfully",
      id: Number(id),
    });
  } catch (err) {
    console.error("DELETE COURSE ERROR:", err);

    if (
      err.code === "ER_ROW_IS_REFERENCED_2" ||
      err.code === "ER_ROW_IS_REFERENCED"
    ) {
      return res.status(409).json({
        error: true,
        message:
          "This course cannot be deleted because it is being used by other records",
      });
    }

    return res.status(500).json({
      error: true,
      message: "Failed to delete course",
    });
  }
};


module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
};