const pool = require("../db");

// CREATE LEVEL
const createLevel = async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: true,
      message: "Level name is required",
    });
  }

  const levelName = name.trim();

  try {
    // Check if level already exists
    const [existingLevel] = await pool.query(
      `SELECT id
       FROM levels
       WHERE name = ?`,
      [levelName]
    );

    if (existingLevel.length > 0) {
      return res.status(400).json({
        error: true,
        message: "Level already exists",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO levels (name)
       VALUES (?)`,
      [levelName]
    );

    const [rows] = await pool.query(
      `SELECT id, name, created_at
       FROM levels
       WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Level created successfully",
      level: rows[0],
    });
  } catch (err) {
    console.error("CREATE LEVEL ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to create level",
    });
  }
};


// GET ALL LEVELS
const getLevels = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, created_at
       FROM levels
       ORDER BY name ASC`
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


// GET LEVEL BY ID
const getLevelById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT id, name, created_at
       FROM levels
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Level not found",
      });
    }

    return res.json({
      success: true,
      level: rows[0],
    });
  } catch (err) {
    console.error("GET LEVEL ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to fetch level",
    });
  }
};


// UPDATE LEVEL
const updateLevel = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: true,
      message: "Level name is required",
    });
  }

  const levelName = name.trim();

  try {
    // Check if level exists
    const [existingLevel] = await pool.query(
      `SELECT id
       FROM levels
       WHERE id = ?`,
      [id]
    );

    if (existingLevel.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Level not found",
      });
    }

    // Check duplicate level
    const [duplicateLevel] = await pool.query(
      `SELECT id
       FROM levels
       WHERE name = ?
       AND id != ?`,
      [levelName, id]
    );

    if (duplicateLevel.length > 0) {
      return res.status(400).json({
        error: true,
        message: "Another level with this name already exists",
      });
    }

    await pool.query(
      `UPDATE levels
       SET name = ?
       WHERE id = ?`,
      [levelName, id]
    );

    const [rows] = await pool.query(
      `SELECT id, name, created_at
       FROM levels
       WHERE id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: "Level updated successfully",
      level: rows[0],
    });
  } catch (err) {
    console.error("UPDATE LEVEL ERROR:", err);

    return res.status(500).json({
      error: true,
      message: "Failed to update level",
    });
  }
};


// DELETE LEVEL
const deleteLevel = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if level exists
    const [existingLevel] = await pool.query(
      `SELECT id
       FROM levels
       WHERE id = ?`,
      [id]
    );

    if (existingLevel.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Level not found",
      });
    }

    await pool.query(
      `DELETE FROM levels
       WHERE id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: "Level deleted successfully",
    });
  } catch (err) {
    console.error("DELETE LEVEL ERROR:", err);

    // Level is being used by another table
    if (
      err.code === "ER_ROW_IS_REFERENCED_2" ||
      err.code === "ER_ROW_IS_REFERENCED"
    ) {
      return res.status(409).json({
        error: true,
        message:
          "This level cannot be deleted because it is being used by other records",
      });
    }

    return res.status(500).json({
      error: true,
      message: "Failed to delete level",
    });
  }
};


module.exports = {
  createLevel,
  getLevels,
  getLevelById,
  updateLevel,
  deleteLevel,
};