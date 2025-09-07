// =====================================
// NUEVO SISTEMA DE BASE DE DATOS - VPS BRIDGE
// =====================================
// 
// Este archivo ahora usa el VPS Bridge para acceder a MySQL
// via VPN Sophos en lugar de la conexión directa de Railway.
// 
// FLUJO: Railway → VPS Bridge → VPN Sophos → MySQL Cliente
// =====================================

require('dotenv').config();

// Verificar si debe usar VPS Bridge
const USE_VPS_BRIDGE = process.env.USE_VPS_BRIDGE === 'true';

if (USE_VPS_BRIDGE) {
  console.log('🌉 Usando VPS Bridge para acceso a MySQL');
  console.log(`📍 VPS Bridge URL: ${process.env.VPS_BRIDGE_URL}`);
  
  // Usar el nuevo sistema VPS Bridge
  module.exports = require('./db-bridge');
} else {
  console.log('🔗 Usando conexión directa MySQL (fallback)');
  
  // Sistema anterior (fallback)
  const mysql = require('mysql2/promise');
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'centerbeam.proxy.rlwy.net',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'gbrIerodvEYzzDQbgtlQjelgLaLlgPuf',
    database: process.env.DB_NAME || 'railway',
    port: parseInt(process.env.DB_PORT) || 32877,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Test de conexión directa
  pool.getConnection()
    .then(connection => {
      console.log('✅ Conexión directa exitosa a la base de datos');
      connection.release();
    })
    .catch(err => {
      console.error('❌ Error al conectar directamente:', err);
    });

  module.exports = pool;
}