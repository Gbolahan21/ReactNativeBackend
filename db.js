const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'user_attendance',
    password: 'attendance',
    database: 'attendance_system',
});

module.exports = pool;