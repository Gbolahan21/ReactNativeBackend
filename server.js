const express = require('express');
const pool = require('./db');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();

app.use(cors());
app.use(express.json());

const initDB = async () => {
    try {
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                firstname VARCHAR(100) NOT NULL,
                lastname VARCHAR(100) NOT NULL,
                matricNo VARCHAR(100) UNIQUE NOT NULL,
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

initDB();

app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

app.post('/register', async (req, res) => {
    const { firstname, lastname, matricNo, password } = req.body;

    try {
        const hashPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO users (firstname, lastname, matricNo, password) VALUES (?, ?, ?, ?)',
            [firstname, lastname, matricNo, hashPassword]
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

        res.json({
        message: 'Login successful',
        user: {
            id: user.id,
            firstname: user.firstname,
            lastname: user.lastname,
            matricNo: user.matricNo,
        },
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});