const pool = require("../db");

const initCourseRegistrationsTable = async () => {
  try {
    const createTable = `
      CREATE TABLE IF NOT EXISTS course_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,

        student_id INT NOT NULL,
        course_id INT NOT NULL,
        semester_id INT NOT NULL,

        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE KEY unique_student_course_semester (
          student_id,
          course_id,
          semester_id
        ),

        CONSTRAINT fk_registration_student
          FOREIGN KEY (student_id)
          REFERENCES students(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_registration_course
          FOREIGN KEY (course_id)
          REFERENCES courses(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_registration_semester
          FOREIGN KEY (semester_id)
          REFERENCES semesters(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      )
    `;

    await pool.query(createTable);

    console.log("✅ Course registrations table ready");

  } catch (err) {
    console.error(
      "❌ Error creating course registrations table:",
      err
    );
  }
};

module.exports = initCourseRegistrationsTable;