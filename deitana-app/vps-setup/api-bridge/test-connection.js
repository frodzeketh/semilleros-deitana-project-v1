#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('🧪 Iniciando test de conexión MySQL...');
  console.log(`📍 Host: ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}`);
  console.log(`📊 Database: ${process.env.MYSQL_DATABASE}`);
  console.log(`👤 User: ${process.env.MYSQL_USER}`);
  console.log('');

  let connection;
  
  try {
    console.log('🔌 Conectando a MySQL...');
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      connectTimeout: 10000,
      acquireTimeout: 10000,
      timeout: 30000
    });

    console.log('✅ Conexión establecida exitosamente!');

    // Test básico - verificar que podemos ejecutar consultas
    console.log('\n🔍 Ejecutando consulta de prueba...');
    const [rows] = await connection.execute('SELECT 1 as test, NOW() as timestamp, VERSION() as mysql_version');
    console.log('✅ Consulta ejecutada exitosamente:');
    console.log(JSON.stringify(rows[0], null, 2));

    // Test de tablas disponibles
    console.log('\n📋 Verificando tablas disponibles...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      ORDER BY TABLE_NAME
    `, [process.env.MYSQL_DATABASE]);

    console.log(`✅ Encontradas ${tables.length} tablas:`);
    tables.slice(0, 10).forEach(table => {
      console.log(`  - ${table.TABLE_NAME} (${table.TABLE_ROWS || 0} filas)`);
    });
    
    if (tables.length > 10) {
      console.log(`  ... y ${tables.length - 10} tablas más`);
    }

    // Test de permisos
    console.log('\n🔒 Verificando permisos del usuario...');
    try {
      const [grants] = await connection.execute('SHOW GRANTS FOR CURRENT_USER()');
      console.log('✅ Permisos del usuario:');
      grants.forEach(grant => {
        console.log(`  - ${Object.values(grant)[0]}`);
      });
    } catch (error) {
      console.log('⚠️  No se pudieron verificar permisos:', error.message);
    }

    // Test de latencia
    console.log('\n⏱️  Midiendo latencia de la conexión...');
    const latencyTests = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await connection.execute('SELECT 1');
      const latency = Date.now() - start;
      latencyTests.push(latency);
    }
    
    const avgLatency = latencyTests.reduce((a, b) => a + b, 0) / latencyTests.length;
    console.log(`✅ Latencia promedio: ${avgLatency.toFixed(2)}ms`);
    console.log(`📊 Latencias individuales: ${latencyTests.join('ms, ')}ms`);

    console.log('\n🎉 Todos los tests pasaron exitosamente!');
    console.log('\n📝 Configuración validada:');
    console.log(`   - Conexión: ✅ Funcional`);
    console.log(`   - Base de datos: ✅ Accesible`);
    console.log(`   - Tablas: ✅ ${tables.length} disponibles`);
    console.log(`   - Latencia: ✅ ${avgLatency.toFixed(2)}ms promedio`);

  } catch (error) {
    console.error('\n❌ Error durante el test de conexión:');
    console.error(`   Código: ${error.code || 'UNKNOWN'}`);
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Host: ${error.address || 'N/A'}:${error.port || 'N/A'}`);
    
    // Sugerencias de troubleshooting
    console.log('\n🔧 Sugerencias de troubleshooting:');
    
    if (error.code === 'ENOTFOUND') {
      console.log('   - Verificar que la VPN Sophos esté conectada');
      console.log('   - Verificar la IP/hostname del servidor MySQL');
      console.log('   - Ejecutar: ping ' + process.env.MYSQL_HOST);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   - Verificar que MySQL esté ejecutándose en el puerto ' + process.env.MYSQL_PORT);
      console.log('   - Verificar firewall del servidor MySQL');
      console.log('   - Ejecutar: telnet ' + process.env.MYSQL_HOST + ' ' + process.env.MYSQL_PORT);
    }
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('   - Verificar usuario y contraseña de MySQL');
      console.log('   - Verificar permisos del usuario en el servidor');
      console.log('   - Contactar al administrador de la base de datos');
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      console.log('   - La conexión VPN puede estar inestable');
      console.log('   - Verificar estado de la VPN: systemctl status openvpn-client@empresa');
      console.log('   - Revisar logs: journalctl -u openvpn-client@empresa -f');
    }

    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Verificar que las variables de entorno están configuradas
const requiredVars = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n📝 Asegúrate de tener un archivo .env con todas las variables requeridas');
  process.exit(1);
}

// Ejecutar test
testConnection().catch(console.error);
