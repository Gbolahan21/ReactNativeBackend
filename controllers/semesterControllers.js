const pool = require("../db");

// CREATE SEMESTER
const createSemester = async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: true,
      message: "Semester name is required",
    });
  }

  const semesterName = name.trim();

  try {
    // Check if semester already exists
    const [existingSemester] = await pool.query(
      `SELECT id
       FROM semesters
       WHERE name = ?`,
      [semesterName]
    );

    if (existingSemester.length > 0) {
      return res.status(400).json({
        error: true,
        message: "Semester already exists",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO semesters (name)
       VALUES (?)`,
      [semesterName]
    );

    const [rows] = await pool.query(
      `SELECT id, name, created_at
       FROM semesters
       WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Semester created successfully",
      semester: rows[0],
    });
  } catch (err) {
    console.error("CREATE SEMESTER ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to create semester",
    });
  }
};


// GET ALL SEMESTERS
const getSemesters = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, is_current, created_at
       FROM semesters
       ORDER BY id ASC`
    );

    return res.json({
      success: true,
      semesters: rows,
    });
  } catch (err) {
    console.error("GET SEMESTERS ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch semesters",
    });
  }
};


// GET SEMESTER BY ID
const getSemesterById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT id, name, is_current, created_at
       FROM semesters
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Semester not found",
      });
    }

    return res.json({
      success: true,
      semester: rows[0],
    });
  } catch (err) {
    console.error("GET SEMESTER ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch semester",
    });
  }
};


// UPDATE SEMESTER
const updateSemester = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: true,
      message: "Semester name is required",
    });
  }

  const semesterName = name.trim();

  try {
    // Check if semester exists
    const [existingSemester] = await pool.query(
      `SELECT id
       FROM semesters
       WHERE id = ?`,
      [id]
    );

    if (existingSemester.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Semester not found",
      });
    }

    // Check duplicate semester
    const [duplicateSemester] = await pool.query(
      `SELECT id
       FROM semesters
       WHERE name = ?
       AND id != ?`,
      [semesterName, id]
    );

    if (duplicateSemester.length > 0) {
      return res.status(400).json({
        error: true,
        message: "Another semester with this name already exists",
      });
    }

    await pool.query(
      `UPDATE semesters
       SET name = ?
       WHERE id = ?`,
      [semesterName, id]
    );

    const [rows] = await pool.query(
      `SELECT id, name, created_at
       FROM semesters
       WHERE id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: "Semester updated successfully",
      semester: rows[0],
    });
  } catch (err) {
    console.error("UPDATE SEMESTER ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to update semester",
    });
  }
};


// DELETE SEMESTER
const deleteSemester = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if semester exists
    const [existingSemester] = await pool.query(
      `SELECT id
       FROM semesters
       WHERE id = ?`,
      [id]
    );

    if (existingSemester.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Semester not found",
      });
    }

    await pool.query(
      `DELETE FROM semesters
       WHERE id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: "Semester deleted successfully",
      id: Number(id),
    });
  } catch (err) {
    console.error("DELETE SEMESTER ERROR:", err);

    // Semester is being used by courses
    if (
      err.code === "ER_ROW_IS_REFERENCED_2" ||
      err.code === "ER_ROW_IS_REFERENCED"
    ) {
      return res.status(409).json({
        error: true,
        message:
          "This semester cannot be deleted because it is being used by other records",
      });
    }

    return res.status(500).json({
      error: true,
      message: "Failed to delete semester",
    });
  }
};

const setCurrentSemester = async (req, res) => {
  const { id } = req.params;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check semester exists
    const [semester] = await connection.query(
      `
      SELECT id, name
      FROM semesters
      WHERE id = ?
      `,
      [id]
    );

    if (semester.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        error: true,
        message: "Semester not found",
      });
    }

    // Remove current status from all semesters
    await connection.query(
      `
      UPDATE semesters
      SET is_current = FALSE
      `
    );

    // Make selected semester current
    await connection.query(
      `
      UPDATE semesters
      SET is_current = TRUE
      WHERE id = ?
      `,
      [id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `${semester[0].name} is now the current semester`,
      semester: {
        id: semester[0].id,
        name: semester[0].name,
        is_current: true,
      },
    });

  } catch (err) {
    await connection.rollback();

    console.error("SET CURRENT SEMESTER ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to set current semester",
    });

  } finally {
    connection.release();
  }
};


module.exports = {
  createSemester,
  getSemesters,
  getSemesterById,
  updateSemester,
  deleteSemester,
  setCurrentSemester
};