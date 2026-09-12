require("dotenv").config();

const express = require("express");
const cors = require("cors");
// const pool = require("./db");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const authMiddleware = require("./middleware/authMiddleware");
const studentRoutes = require("./routes/studentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

// Routes
app.use("/student", studentRoutes);
app.use("/admin", adminRoutes);
app.use("/attendance", attendanceRoutes);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});