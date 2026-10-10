const pool = require("../db");

const isValidAcademicYear = (year) => {
  if (typeof year !== "string") return false;

  const match = year.trim().match(/^(\d{4})\/(\d{4})$/);

  if (!match) return false;

  return Number(match[2]) === Number(match[1]) + 1;
};

// CREATE SEMESTER
const createSemester = async (req, res) => {
  const { name, academic_year } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: true,
      message: "Semester name is required",
    });
  }

  if (!isValidAcademicYear(academic_year)) {
    return res.status(400).json({
      error: true,
      message: "Academic year must be in YYYY/YYYY format, e.g. 2026/2027",
    });
  }

  const semesterName = name.trim();
  const academicYear = academic_year.trim();

  try {
    // Check if semester already exists
    const [existing] = await pool.query(
      `SELECT id
       FROM semesters
       WHERE name = ? AND academic_year = ?`,
      [semesterName, academicYear]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: true,
        message: "This semester already exists for the selected academic year",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO semesters (name, academic_year)
       VALUES (?, ?)`,
      [semesterName, academicYear]
    );

    const [rows] = await pool.query(
      `SELECT id, name, academic_year, is_current, created_at
       FROM semesters WHERE id = ?`,
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
      `SELECT id, name, academic_year, is_current, created_at
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
      `SELECT id, name, academic_year, is_current, created_at
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
  const { name, academic_year } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: true,
      message: "Semester name is required",
    });
  }

  if (typeof academic_year !== "string" || !isValidAcademicYear(academic_year.trim())) {
    return res.status(400).json({
      error: true,
      message: "Academic year must be in YYYY/YYYY format, e.g. 2026/2027",
    });
  }

  const semesterName = name.trim();
  const academicYear = academic_year.trim();

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      `SELECT id, name, academic_year, is_current
        FROM semesters WHERE id = ?
        FOR UPDATE`,
      [id]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: true,
        message: "Semester not found",
      });
    }

    const existing = existingRows[0];
    const oldAcademicYear = existing.academic_year;

    const [duplicate] = await connection.query(
      `SELECT id FROM semesters
       WHERE name = ?
       AND academic_year = ?
       AND id != ?`,
      [semesterName, academicYear, id]
    );

    if (duplicate.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: true,
        message: "Another semester with this name already exists for this academic year",
      });
    }

    const oldYearMatch = /^(\d{4})\/(\d{4})$/.exec(
      oldAcademicYear || ""
    );

    const newYearMatch = /^(\d{4})\/(\d{4})$/.exec(
      academicYear
    );

    const isNextAcademicYear = 
      oldYearMatch && 
      newYearMatch && 
      Number(oldYearMatch[2]) === Number(oldYearMatch[1]) + 1 && 
      Number(newYearMatch[1]) === Number(oldYearMatch[1]) + 1 && 
      Number(newYearMatch[2]) === Number(oldYearMatch[2]) + 1;

    let promotedCount = 0;

    if (existing.is_current && isNextAcademicYear) {
      const [levelRows] = await connection.query(
        `SELECT id, name FROM levels`
      );

      const levelIds = new Map();

      for (const level of levelRows) { 
        const match = /^(\d+)\s*level$/i.exec(
          String(level.name).trim()
        );

        if (match) { 
          levelIds.set(Number(match[1]), level.id); 
        } 
      }

      for (const level of [100, 200, 300, 400, 500, 600]) { 
        if (!levelIds.has(level)) { 
          throw new Error(`Missing level: ${level} Level`); 
        } 
      }

      let graduatedCount = 0;

      const [graduated600] = await connection.query( 
        `UPDATE students 
          SET status = 'Graduated' 
          WHERE level_id = ? 
          AND status = 'Active'`, 
        [levelIds.get(600)] 
      );

      graduatedCount += graduated600.affectedRows;

      const [graduated500] = await connection.query(
        `UPDATE students s
        JOIN departments d ON d.id = s.department_id
        SET s.status = 'Graduated'
        WHERE s.level_id = ?
          AND s.status = 'Active'
          AND d.max_level = 500`,
        [levelIds.get(500)]
      );

      graduatedCount += graduated500.affectedRows;

      const [promoted500] = await connection.query(
        `UPDATE students s
        JOIN departments d ON d.id = s.department_id
        SET s.level_id = ?
        WHERE s.level_id = ?
          AND s.status = 'Active'
          AND d.max_level = 600`,
        [levelIds.get(600), levelIds.get(500)]
      );

      promotedCount += promoted500.affectedRows;

      const [promoted400] = await connection.query( 
        `UPDATE students 
          SET level_id = ? 
          WHERE level_id = ? 
          AND status = 'Active'`, 
        [levelIds.get(500), levelIds.get(400)] 
      ); 
      
      promotedCount += promoted400.affectedRows;

      const [promoted300] = await connection.query( 
        `UPDATE students 
          SET level_id = ? 
          WHERE level_id = ? 
          AND status = 'Active'`, 
        [levelIds.get(400), levelIds.get(300)] 
      ); 
      
      promotedCount += promoted300.affectedRows;

      const [promoted200] = await connection.query( 
        `UPDATE students 
          SET level_id = ? 
          WHERE level_id = ? 
          AND status = 'Active'`, 
        [levelIds.get(300), levelIds.get(200)] 
      ); 
      
      promotedCount += promoted200.affectedRows;

      const [promoted100] = await connection.query( 
        `UPDATE students 
          SET level_id = ? 
          WHERE level_id = ? 
          AND status = 'Active'`, 
        [levelIds.get(200), levelIds.get(100)] 
      ); 
      
      promotedCount += promoted100.affectedRows;

      req.promotionSummary = { 
        promotedCount, 
        graduatedCount, 
      };
    }

    await connection.query(
      `UPDATE semesters
       SET name = ?, academic_year = ?
       WHERE id = ?`,
      [semesterName, academicYear, id]
    );

    const [updatedRows] = await connection.query( 
      `SELECT id, name, academic_year, is_current, created_at 
        FROM semesters 
        WHERE id = ?`,
      [id] 
    );

    await connection.commit();

    const summary = req.promotionSummary || {
      promotedCount: 0,
      graduatedCount: 0,
    };

    return res.json({
      success: true,
      message: "Semester updated successfully",
      semester: updatedRows[0],
      studentsPromoted: summary.promotedCount,
      studentsGraduated: summary.graduatedCount,
    });
  } catch (err) {
    await connection.rollback();
    console.error("UPDATE SEMESTER ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to update semester",
    });
  }
  finally { 
    connection.release(); 
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