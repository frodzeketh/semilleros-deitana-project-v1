const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,        // Utiliza la variable DB_HOST del .env
  user: process.env.DB_USER,        // Utiliza la variable DB_USER del .env
  password: process.env.DB_PASSWORD, // Utiliza la variable DB_PASSWORD del .env
  database: process.env.DB_NAME,    // Utiliza la variable DB_NAME del .env
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
