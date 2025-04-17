// server/routes/chat-sql.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { getQueryFromIA, getAnalyticalResponse } = require('../utils/deepseek.js');

// Variable para mantener el contexto de la conversación
let conversationContext = {
  lastTopic: null,
  lastResults: null,
  lastQuery: null
};

router.post('/', async (req, res) => {
  const { userMessage } = req.body;

  try {
    // Primero intentar con la respuesta analítica que maneja el contexto
    const analyticalResponse = await getAnalyticalResponse(userMessage);
    if (analyticalResponse) {
      return res.json({ 
        data: analyticalResponse,
        context: conversationContext
      });
    }

    // Si no hay respuesta analítica, proceder con la consulta SQL
    const sqlQuery = await getQueryFromIA(userMessage);
    const [rows] = await db.query(sqlQuery);
    
    res.json({ 
      data: rows, 
      query: sqlQuery,
      context: conversationContext
    });
  } catch (error) {
    console.error('Error en /chat-sql:', error);
    res.status(500).json({ error: 'No se pudo procesar la consulta' });
  }
});

module.exports = router;
