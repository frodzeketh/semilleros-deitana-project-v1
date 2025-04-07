const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,  // Ejemplo: localhost
  port: process.env.DB_PORT,  // Ejemplo: 3306
  user: process.env.DB_USER,  // Ejemplo: root
  password: process.env.DB_PASSWORD,  // Ejemplo: root
  database: process.env.DB_NAME,  // Ejemplo: erp_local
});

module.exports = db;
