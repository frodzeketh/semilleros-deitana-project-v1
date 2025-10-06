const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { processQueryStream } = require('../admin/core/openAI');

// Middleware para todas las rutas
router.use(verifyToken);

// Ruta simple para streaming
router.post('/stream', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Mensaje requerido' });
        }

        // Respuesta directa con GPT-4o
        await processQueryStream({ message, response: res });
        
    } catch (error) {
        console.error('Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
});

module.exports = router;