const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verificar la conexión
pool.getConnection()
  .then(connection => {
    console.log('Base de datos conectada correctamente');
    connection.release();
  })
  .catch(error => {
    console.error('Error conectando a la base de datos:', error);
  });

module.exports = pool;