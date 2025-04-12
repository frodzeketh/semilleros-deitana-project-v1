// server/routes/chat-sql.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { getQueryFromIA } = require('../utils/deepseek.js'); // función que le pide a la IA una query

router.post('/', async (req, res) => {
  const { userMessage } = req.body;

  try {
    const sqlQuery = await getQueryFromIA(userMessage); // acá DeepSeek arma la query
    const [rows] = await db.query(sqlQuery);            // acá se ejecuta la query
    res.json({ data: rows, query: sqlQuery });
  } catch (error) {
    console.error('Error en /chat-sql:', error);
    res.status(500).json({ error: 'No se pudo procesar la consulta' });
  }
});

module.exports = router;
