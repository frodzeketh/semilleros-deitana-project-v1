const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { processQueryStream } = require('../admin/core/openAI');

// Middleware para todas las rutas
router.use(verifyToken);

// Ruta para obtener contexto de la empresa para Realtime API
router.get('/company-context', async (req, res) => {
    try {
        const { searchRelevantInfo } = require('../admin/core/openAI');
        
        // Obtener información general de la empresa
        const info = await searchRelevantInfo('información general de Semilleros Deitana política fichaje clientes vendedores');
        
        const instructions = `Eres un asistente especializado de Semilleros Deitana, S.L.

INFORMACIÓN DE LA EMPRESA:
${info}

INSTRUCCIONES:
- Responde de manera amigable y profesional con emojis 😊
- Si la pregunta requiere datos específicos de base de datos, usa la función query_backend
- Para preguntas generales, usa la información de arriba
- Mantén un tono cercano y útil`;

        res.json({ instructions });
    } catch (error) {
        console.error('Error:', error);
        res.json({ instructions: 'Eres un asistente de Semilleros Deitana, S.L. Responde de manera amigable.' });
    }
});

// Ruta simple para streaming
router.post('/stream', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Mensaje requerido' });
        }

        // Respuesta con memoria RAM
        await processQueryStream({ 
            message, 
            conversationId: req.body.conversationId || `temp_${Date.now()}`,
            response: res 
        });
        
    } catch (error) {
        console.error('Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
});

module.exports = router; 