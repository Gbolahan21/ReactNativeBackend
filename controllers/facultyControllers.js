const pool = require("../db");

// CREATE FACULTY
const createFaculty = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Faculty name is required",
      });
    }

    const facultyName = name.trim();

    // Check if faculty already exists
    const [existingFaculty] = await pool.query(
      "SELECT id FROM faculties WHERE name = ?",
      [facultyName]
    );

    if (existingFaculty.length > 0) {
      return res.status(409).json({
        message: "Faculty already exists",
      });
    }

    const [result] = await pool.query(
      "INSERT INTO faculties (name) VALUES (?)",
      [facultyName]
    );

    const [faculty] = await pool.query(
      "SELECT * FROM faculties WHERE id = ?",
      [result.insertId]
    );

    return res.status(201).json({
      message: "Faculty created successfully",
      faculty: faculty[0],
    });
  } catch (error) {
    console.error("Create faculty error:", error);

    return res.status(500).json({
      message: "Failed to create faculty",
    });
  }
};


// GET ALL FACULTIES
const getFaculties = async (req, res) => {
  try {
    const [faculties] = await pool.query(
      "SELECT * FROM faculties ORDER BY name ASC"
    );

    return res.status(200).json({
      faculties,
    });
  } catch (error) {
    console.error("Get faculties error:", error);

    return res.status(500).json({
      message: "Failed to fetch faculties",
    });
  }
};


// GET SINGLE FACULTY
const getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;

    const [faculties] = await pool.query(
      "SELECT * FROM faculties WHERE id = ?",
      [id]
    );

    if (faculties.length === 0) {
      return res.status(404).json({
        message: "Faculty not found",
      });
    }

    return res.status(200).json({
      faculty: faculties[0],
    });
  } catch (error) {
    console.error("Get faculty error:", error);

    return res.status(500).json({
      message: "Failed to fetch faculty",
    });
  }
};


// UPDATE FACULTY
const updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Faculty name is required",
      });
    }

    const facultyName = name.trim();

    // Check faculty exists
    const [existingFaculty] = await pool.query(
      "SELECT id FROM faculties WHERE id = ?",
      [id]
    );

    if (existingFaculty.length === 0) {
      return res.status(404).json({
        message: "Faculty not found",
      });
    }

    // Check duplicate name
    const [duplicateFaculty] = await pool.query(
      "SELECT id FROM faculties WHERE name = ? AND id != ?",
      [facultyName, id]
    );

    if (duplicateFaculty.length > 0) {
      return res.status(409).json({
        message: "Another faculty with this name already exists",
      });
    }

    await pool.query(
      "UPDATE faculties SET name = ? WHERE id = ?",
      [facultyName, id]
    );

    const [faculty] = await pool.query(
      "SELECT * FROM faculties WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      message: "Faculty updated successfully",
      faculty: faculty[0],
    });
  } catch (error) {
    console.error("Update faculty error:", error);

    return res.status(500).json({
      message: "Failed to update faculty",
    });
  }
};


// DELETE FACULTY
const deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;

    // Check faculty exists
    const [existingFaculty] = await pool.query(
      "SELECT id FROM faculties WHERE id = ?",
      [id]
    );

    if (existingFaculty.length === 0) {
      return res.status(404).json({
        message: "Faculty not found",
      });
    }

    await pool.query(
      "DELETE FROM faculties WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Faculty deleted successfully",
      id: Number(id),
    });
  } catch (error) {
    console.error("Delete faculty error:", error);

    // Faculty may have departments attached to it
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        message:
          "This faculty cannot be deleted because it has departments assigned to it",
      });
    }

    return res.status(500).json({
      message: "Failed to delete faculty",
    });
  }
};


module.exports = {
  createFaculty,
  getFaculties,
  getFacultyById,
  updateFaculty,
  deleteFaculty,
};