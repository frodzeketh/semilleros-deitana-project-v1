const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { processQueryStream } = require('../admin/core/openAI');

// Middleware para todas las rutas
router.use(verifyToken);

// Ruta para procesar consultas desde Realtime API (function calling)
router.post('/process-voice', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Mensaje requerido' });
        }

        console.log('🎙️ [PROCESS-VOICE] Procesando desde Realtime API:', message);

        let fullResponse = '';

        // Mock response para capturar la respuesta
        const mockResponse = {
            headersSent: false,
            write: (chunk) => {
                const data = chunk.toString();
                try {
                    const jsonData = JSON.parse(data);
                    if (jsonData.type === 'chunk' && jsonData.content) {
                        fullResponse += jsonData.content;
                    }
                } catch (e) {
                    // Ignorar
                }
                return true;
            },
            end: () => {},
            setHeader: () => mockResponse,
            getHeader: () => undefined,
            removeHeader: () => mockResponse,
            json: () => mockResponse,
            status: (code) => mockResponse,
            send: () => mockResponse
        };

        // Procesar con openAI.js (RAG + SQL)
        await processQueryStream({ 
            message, 
            conversationId: `voice_${Date.now()}`,
            response: mockResponse
        });

        console.log('✅ [PROCESS-VOICE] Respuesta generada:', fullResponse.substring(0, 100) + '...');

        res.json({ response: fullResponse });
        
    } catch (error) {
        console.error('❌ [PROCESS-VOICE] Error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener contexto de la empresa para Realtime API
router.get('/company-context', async (req, res) => {
    try {
        const instructions = `Eres un asistente especializado de Semilleros Deitana, S.L.

⚠️ REGLA CRÍTICA:
- SIEMPRE que te pregunten sobre políticas, normas, fichaje, clientes, productos, o CUALQUIER información específica de Semilleros Deitana → DEBES usar la función query_backend()
- NO inventes respuestas
- NO respondas basándote en conocimiento general
- query_backend() tiene acceso a toda la información de la empresa (RAG + Base de datos)

EJEMPLOS DE CUÁNDO USAR query_backend():
- "¿Qué pasa si llego tarde?"
- "¿Cuántos clientes tenemos?"
- "¿Qué hacemos con las zanahorias?"
- "¿Quién es Pedro Muñoz?"
- "¿Cuál es la política de fichaje?"
- Cualquier pregunta sobre la empresa

SOLO responde directamente para:
- Saludos simples ("hola", "buenos días")
- Agradecimientos ("gracias", "ok")
- Conversación general

ESTILO:
- Amigable y profesional con emojis 😊
- Respuestas claras y útiles
- Siempre en español`;

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