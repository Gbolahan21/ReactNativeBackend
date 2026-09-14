const pool = require("../db");

// CREATE DEPARTMENT
const createDepartment = async (req, res) => {
  const { name, faculty_id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: true,
      message: "Department name is required",
    });
  }

  if (!faculty_id) {
    return res.status(400).json({
      error: true,
      message: "Faculty is required",
    });
  }

  const departmentName = name.trim();

  try {
    // Check if faculty exists
    const [faculty] = await pool.query(
      `SELECT id FROM faculties WHERE id = ?`,
      [faculty_id]
    );

    if (faculty.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Faculty not found",
      });
    }

    // Check duplicate department within the same faculty
    const [existingDepartment] = await pool.query(
      `SELECT id
       FROM departments
       WHERE name = ? AND faculty_id = ?`,
      [departmentName, faculty_id]
    );

    if (existingDepartment.length > 0) {
      return res.status(400).json({
        error: true,
        message: "Department already exists in this faculty",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO departments (faculty_id, name)
       VALUES (?, ?)`,
      [faculty_id, departmentName]
    );

    const [rows] = await pool.query(
      `SELECT
        d.id,
        d.name,
        d.faculty_id,
        f.name AS faculty_name,
        d.created_at
       FROM departments d
       JOIN faculties f ON d.faculty_id = f.id
       WHERE d.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      department: rows[0],
    });
  } catch (err) {
    console.error("CREATE DEPARTMENT ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to create department",
    });
  }
};


// GET ALL DEPARTMENTS
const getDepartments = async (req, res) => {
  const { faculty_id } = req.query;

  try {
    let query = `
      SELECT
        d.id,
        d.name,
        d.faculty_id,
        f.name AS faculty_name,
        d.created_at
      FROM departments d
      JOIN faculties f ON d.faculty_id = f.id
    `;

    const params = [];

    // Optional faculty filter
    if (faculty_id) {
      query += ` WHERE d.faculty_id = ?`;
      params.push(faculty_id);
    }

    query += ` ORDER BY d.name ASC`;

    const [rows] = await pool.query(query, params);

    return res.json({
      success: true,
      departments: rows,
    });
  } catch (err) {
    console.error("GET DEPARTMENTS ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch departments",
    });
  }
};


// GET DEPARTMENT BY ID
const getDepartmentById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT
        d.id,
        d.name,
        d.faculty_id,
        f.name AS faculty_name,
        d.created_at
       FROM departments d
       JOIN faculties f ON d.faculty_id = f.id
       WHERE d.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Department not found",
      });
    }

    return res.json({
      success: true,
      department: rows[0],
    });
  } catch (err) {
    console.error("GET DEPARTMENT ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch department",
    });
  }
};


// UPDATE DEPARTMENT
const updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name, faculty_id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: true,
      message: "Department name is required",
    });
  }

  if (!faculty_id) {
    return res.status(400).json({
      error: true,
      message: "Faculty is required",
    });
  }

  const departmentName = name.trim();

  try {
    // Check department exists
    const [existingDepartment] = await pool.query(
      `SELECT id
       FROM departments
       WHERE id = ?`,
      [id]
    );

    if (existingDepartment.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Department not found",
      });
    }

    // Check faculty exists
    const [faculty] = await pool.query(
      `SELECT id
       FROM faculties
       WHERE id = ?`,
      [faculty_id]
    );

    if (faculty.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Faculty not found",
      });
    }

    // Check duplicate
    const [duplicateDepartment] = await pool.query(
      `SELECT id
       FROM departments
       WHERE name = ?
       AND faculty_id = ?
       AND id != ?`,
      [departmentName, faculty_id, id]
    );

    if (duplicateDepartment.length > 0) {
      return res.status(400).json({
        error: true,
        message: "Another department with this name already exists in this faculty",
      });
    }

    await pool.query(
      `UPDATE departments
       SET name = ?, faculty_id = ?
       WHERE id = ?`,
      [departmentName, faculty_id, id]
    );

    const [rows] = await pool.query(
      `SELECT
        d.id,
        d.name,
        d.faculty_id,
        f.name AS faculty_name,
        d.created_at
       FROM departments d
       JOIN faculties f ON d.faculty_id = f.id
       WHERE d.id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: "Department updated successfully",
      department: rows[0],
    });
  } catch (err) {
    console.error("UPDATE DEPARTMENT ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to update department",
    });
  }
};


// DELETE DEPARTMENT
const deleteDepartment = async (req, res) => {
  const { id } = req.params;

  try {
    // Check department exists
    const [existingDepartment] = await pool.query(
      `SELECT id
       FROM departments
       WHERE id = ?`,
      [id]
    );

    if (existingDepartment.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Department not found",
      });
    }

    await pool.query(
      `DELETE FROM departments
       WHERE id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (err) {
    console.error("DELETE DEPARTMENT ERROR:", err);

    // Department is being used by another table
    if (
      err.code === "ER_ROW_IS_REFERENCED_2" ||
      err.code === "ER_ROW_IS_REFERENCED"
    ) {
      return res.status(409).json({
        error: true,
        message:
          "This department cannot be deleted because it is being used by other records",
      });
    }

    return res.status(500).json({
      error: true,
      message: "Failed to delete department",
    });
  }
};


module.exports = {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
};