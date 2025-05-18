const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('Intentando conectar a la base de datos...');

const pool = mysql.createPool({
  host: 'centerbeam.proxy.rlwy.net',
  user: 'root',
  password: 'gbrIerodvEYzzDQbgtlQjelgLaLlgPuf',
  database: 'railway',
  port: 32877,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test de conexión
pool.getConnection()
  .then(connection => {
    console.log('Conexión exitosa a la base de datos');
    connection.release();
  })
  .catch(err => {
    console.error('Error al conectar a la base de datos:', err);
  });

module.exports = pool;