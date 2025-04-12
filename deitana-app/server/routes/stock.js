const express = require('express');
const router = express.Router();
const db = require('../db');

// Ejemplo: obtener listado de productos
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos LIMIT 30');
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar stock:', error);
    res.status(500).json({ error: 'Error al obtener el stock' });
  }
});

module.exports = router;
