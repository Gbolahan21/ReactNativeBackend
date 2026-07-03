require("dotenv").config();

const express = require("express");
const pool = require("./db");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const initUsersTable = async () => {
    try {
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                firstname VARCHAR(100) NOT NULL,
                lastname VARCHAR(100) NOT NULL,
                matricNo VARCHAR(100) UNIQUE NOT NULL,
                department VARCHAR(100) NOT NULL,
                faculty VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await pool.query(createUsersTable);
        console.log("✅ Users table ready");
    } catch (err) {
        console.error("❌ Error creating table:", err);
    }
};

const initAttendanceTable = async () => {
    try {
        const createAttendanceTable = `
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                attendance_date DATE NOT NULL,
                check_in TIME,
                check_out TIME,
                status VARCHAR(20),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `;

        await pool.query(createAttendanceTable);
        console.log("✅ Attendance table ready");
    } catch (err) {
        console.error("❌ Error creating table:", err);
    }
};

initUsersTable();

initAttendanceTable();

app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

app.post('/register', async (req, res) => {
    const { firstname, lastname, matricNo, department, faculty, password } = req.body;

    try {
        const hashPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO users (firstname, lastname, matricNo, department, faculty, password) VALUES (?, ?, ?, ?, ?, ?)',
            [firstname, lastname, matricNo, department, faculty, hashPassword]
        );

        res.status(201).json({
            success: true,
            message: "Registration successful",
        });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({
                error: "Matric number already exists",
            });
        }

        res.status(500).json({
            error: "Internal server error",
        });
    }
})

app.post('/login', async(req, res) => {
    const { matricNo, password } = req.body;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE matricNo = ?',
            [matricNo]
        )

        if (rows.length === 0) {
          return res.status(400).json({ error: 'User not found' });
        }

        const user = rows[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.status(400).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ id: user.id,  matricNo: user.matricNo, }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
          message: 'Login successful',
          token: token,
          user: {
            id: user.id,
            firstname: user.firstname,
            lastname: user.lastname,
            matricNo: user.matricNo,
            department: user.department,
            faculty: user.faculty,
          },
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

app.post("/attendance/checkin", async (req, res) => {
    const { userId } = req.body;

    try {
        const [existing] = await pool.query(
            `SELECT * FROM attendance
             WHERE user_id = ?
             AND attendance_date = CURDATE()`,
            [userId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: "Attendance has already been recorded today."
            });
        }

        await pool.query(
            `INSERT INTO attendance
            (user_id, attendance_date, check_in, status)
            VALUES (?, CURDATE(), CURTIME(), ?)`,
            [userId, "Present"]
        );

        res.json({
            message: "Attendance recorded successfully."
        });

    } catch (err) {
        res.status(500).json({
            error: err.message,
        });
    }
});

app.get("/attendance/today/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const [rows] = await pool.query(
            `
            SELECT
                attendance_date,
                check_in,
                check_out,
                status
            FROM attendance
            WHERE user_id = ?
            AND attendance_date = CURDATE()
            `,
            [userId]
        );

        if (rows.length === 0) {
            return res.json({
                status: "Not Recorded"
            });
        }

        res.json(rows[0]);

    } catch (err) {
        res.status(500).json({
            error: err.message,
        });
    }
});

app.get("/attendance/history/:userId", async (req, res) => {
    const { userId } = req.params;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        // Get paginated attendance records
        const [rows] = await pool.query(
            `
            SELECT
                id,
                attendance_date,
                check_in,
                check_out,
                status
            FROM attendance
            WHERE user_id = ?
            ORDER BY attendance_date DESC
            LIMIT ? OFFSET ?
            `,
            [userId, limit, offset]
        );

        // Get total number of records
        const [countResult] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM attendance
            WHERE user_id = ?
            `,
            [userId]
        );

        const totalRecords = countResult[0].total;
        const totalPages = Math.ceil(totalRecords / limit);

        res.json({
            records: rows,
            page,
            limit,
            totalRecords,
            totalPages,
        });

    } catch (err) {
        res.status(500).json({
            error: err.message,
        });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});