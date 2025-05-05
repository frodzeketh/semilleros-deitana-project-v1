// server/routes/chat-sql.js
const express = require('express');
const router = express.Router();
const { processMessage } = require('../utils/deepseek.js'); // Asegúrate de exportar esta función en deepseek.js

router.post('/', async (req, res) => {
  const { userMessage } = req.body;

  try {
    // Llama a la función principal que gestiona todo el flujo (promptBase, mapaERP, etc.)
    const respuesta = await processMessage(userMessage);

    // Devuelve la respuesta al frontend
    return res.json({ data: respuesta });
  } catch (error) {
    console.error('Error en /chat-sql:', error);
    return res.status(500).json({ error: 'No se pudo procesar la consulta' });
  }
});

module.exports = router;