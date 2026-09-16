require("dotenv").config();

const express = require("express");
const cors = require("cors");

const studentRoutes = require("./routes/studentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const facultyRoutes = require("./routes/facultyRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const levelRoutes = require("./routes/levelRoutes");
const courseRoutes = require("./routes/courseRoutes");
const semesterRoutes = require("./routes/semesterRoutes");
const courseRegistrationRoutes = require("./routes/courseRegistrationRoutes");

const initCourseRegistrationsTable = require(
  "./databases/initCourseRegistrationsTable"
);

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
app.use("/faculty", facultyRoutes);
app.use("/department", departmentRoutes);
app.use("/level", levelRoutes);
app.use("/course", courseRoutes);
app.use("/semester", semesterRoutes);
app.use("/course-registration", courseRegistrationRoutes);

initCourseRegistrationsTable();


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});