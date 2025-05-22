const pool = require('./db');

async function testQuery() {
    try {
        // Primero, veamos la estructura de la tabla
        const [columns] = await pool.query('SHOW COLUMNS FROM clientes');
        console.log('Estructura de la tabla clientes:', columns);

        // Luego, veamos algunos datos
        const [rows] = await pool.query('SELECT * FROM clientes LIMIT 2');
        console.log('Datos de ejemplo:', rows);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

testQuery(); 