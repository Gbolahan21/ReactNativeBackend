const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../utils/email");
const pool = require("../db");
const router = express.Router();

const initForgotPasswordTable = async () => {
  try {
    const createForgotPasswordTable = `
      CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (student_id)
            REFERENCES students(id)
            ON DELETE CASCADE
      )
    `;

    await pool.query(createForgotPasswordTable);

    console.log("✅ Forgot password table ready");
  } catch (err) {
    console.error("❌ Error creating forgot password table:", err);
  }
};

initForgotPasswordTable();

router.post("/student/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find student
    const [[student]] = await pool.query(
      `
      SELECT id, firstname, lastname, email
      FROM students
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [normalizedEmail]
    );

    /*
     * Don't reveal whether the email exists.
     * This prevents someone from using this endpoint
     * to discover registered student accounts.
     */
    if (!student) {
      return res.json({
        success: true,
        message:
          "If an account exists with this email, a password reset code has been sent.",
      });
    }

    // Generate a 6-digit code
    const resetCode = crypto
      .randomInt(100000, 1000000)
      .toString();

    // Hash the code before storing it
    const hashedCode = await bcrypt.hash(resetCode, 10);

    // Invalidate previous unused reset codes
    await pool.query(
      `
      UPDATE password_resets
      SET used = 1
      WHERE student_id = ?
        AND used = 0
      `,
      [student.id]
    );

    // Store the new reset code
    await pool.query(
      `
      INSERT INTO password_resets
        (student_id, token, expires_at)
      VALUES
        (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
      `,
      [student.id, hashedCode]
    );

    // Send email
    await sendEmail({
      to: student.email,
      subject: "Fingerprint Attendance System Password Reset Code",

      text: `
Hello ${student.firstname},

Your Fingerprint Attendance System password reset code is:

${resetCode}

This code expires in 10 minutes.

If you did not request a password reset, you can safely ignore this email.

Fingerprint Attendance System
      `,

      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Fingerprint Attendance System</h2>

          <p>Hello ${student.firstname},</p>

          <p>
            You requested to reset your Fingerprint Attendance System password.
          </p>

          <p>Your password reset code is:</p>

          <h1 style="letter-spacing: 8px;">
            ${resetCode}
          </h1>

          <p>
            This code will expire in <strong>10 minutes</strong>.
          </p>

          <p>
            If you did not request a password reset,
            you can safely ignore this email.
          </p>

          <p>
            Fingerprint Attendance System
          </p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message:
        "If an account exists with this email, a password reset code has been sent.",
    });

  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process password reset request.",
    });
  }
});

router.post("/student/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!/^\d{6}$/.test(trimmedCode)) {
      return res.status(400).json({
        success: false,
        message: "Verification code must be 6 digits.",
      });
    }

      // Find student
    const [[student]] = await pool.query(
      `
      SELECT id
      FROM students
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (!student) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

      // Find the latest unused reset code
    const [[reset]] = await pool.query(
      `
      SELECT
        id,
        token,
        expires_at
      FROM password_resets
      WHERE student_id = ?
        AND used = 0
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [student.id]
    );

    if (!reset) {
      return res.status(400).json({
        success: false,
        message: "No active password reset request was found.",
      });
    }

      // Check expiration
    if (new Date(reset.expires_at) < new Date()) {
      await pool.query(
        `
        UPDATE password_resets
        SET used = 1
        WHERE id = ?
        `,
        [reset.id]
      );

      return res.status(400).json({
        success: false,
        message: "This verification code has expired. Please request a new one.",
      });
    }

    // Compare entered code with stored hash
    const isValid = await bcrypt.compare(
      trimmedCode,
      reset.token
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    return res.json({
      success: true,
      message: "Verification code verified successfully.",
      resetToken: reset.id,
    });

  } catch (error) {
    console.error(
      "VERIFY RESET CODE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to verify the password reset code.",
    });
  }
});

router.post("/student/reset-password", async (req, res) => {
  try {
    const {
      email,
      resetToken,
      password,
    } = req.body;

    // Validate required fields
    if (!email || !resetToken || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email, reset token and password are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters.",
      });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain an uppercase letter.",
      });
    }

    if (!/[a-z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain a lowercase letter.",
      });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain a number.",
      });
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain a special character.",
      });
    }

    // Find student
    const [[student]] = await pool.query(
      `
      SELECT id
      FROM students
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (!student) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid password reset request.",
      });
    }

    // Find the reset request
    const [[reset]] = await pool.query(
      `
      SELECT
        id,
        student_id,
        expires_at,
        used
      FROM password_resets
      WHERE id = ?
        AND student_id = ?
        AND used = 0
      LIMIT 1
      `,
      [
        resetToken,
        student.id,
      ]
    );

    if (!reset) {
      return res.status(400).json({
        success: false,
        message:
          "This password reset session is invalid or has already been used.",
      });
    }

    // Check expiration
    if (
      new Date(reset.expires_at) <
      new Date()
    ) {
      await pool.query(
        `
        UPDATE password_resets
        SET used = 1
        WHERE id = ?
        `,
        [reset.id]
      );

      return res.status(400).json({
        success: false,
        message:
          "This password reset session has expired. Please request a new code.",
      });
    }

    // Hash new password
    const hashedPassword =
      await bcrypt.hash(password, 12);

    // Update student's password
    await pool.query(
      `
      UPDATE students
      SET password = ?
      WHERE id = ?
      `,
      [
        hashedPassword,
        student.id,
      ]
    );

    // Invalidate the reset token
    await pool.query(
      `
      UPDATE password_resets
      SET used = 1
      WHERE id = ?
      `,
      [reset.id]
    );

    // Invalidate any other unused reset requests
    await pool.query(
      `
      UPDATE password_resets
      SET used = 1
      WHERE student_id = ?
        AND used = 0
      `,
      [student.id]
    );

    return res.json({
      success: true,
      message:
        "Your password has been reset successfully.",
    });

  } catch (error) {
    console.error(
      "RESET PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to reset your password.",
    });
  }
});


module.exports = router;