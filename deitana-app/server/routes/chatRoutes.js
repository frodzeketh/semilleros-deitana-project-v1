const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isEmployee } = require('../middleware/authMiddleware');
const chatManager = require('../utils/chatManager');
const { adminEmails } = require('../adminEmails');
const { processQueryStream } = require('../admin/core/openAI');

// Middleware para todas las rutas
router.use(verifyToken);

// =====================================
// RUTA PARA STREAMING EN TIEMPO REAL
// =====================================
router.post('/stream', async (req, res) => {
    try {
        const { message, conversationId } = req.body;
        const userId = req.user.uid;
        const isAdmin = req.user.isAdmin;
        
        console.log('🚀 [STREAM-ROUTE] Iniciando streaming para usuario:', userId);
        console.log('🚀 [STREAM-ROUTE] Mensaje:', message);
        console.log('🚀 [STREAM-ROUTE] Conversación ID:', conversationId);
        console.log('🚀 [STREAM-ROUTE] Es admin:', isAdmin);
        
        let currentConversationId = conversationId;

        // Si no hay conversación o es temporal, crear una nueva
        if (!currentConversationId || currentConversationId.startsWith('temp_')) {
            currentConversationId = await chatManager.createConversation(userId, message);
            console.log('🆕 [STREAM-ROUTE] Nueva conversación creada:', currentConversationId);
        }

        // Verificar que la conversación existe
        try {
            await chatManager.verifyChatOwnership(userId, currentConversationId);
        } catch (error) {
            console.error('❌ [STREAM-ROUTE] Error al verificar la conversación:', error);
            return res.status(404).json({
                success: false,
                error: 'Conversación no encontrada'
            });
        }

        // Agregar mensaje del usuario al historial
        await chatManager.addMessageToConversation(userId, currentConversationId, {
            role: 'user',
            content: message
        });
        
        // Llamar a la función de streaming que maneja la respuesta según el rol
        let streamResult;
        if (isAdmin) {
            streamResult = await processQueryStream({ 
                message, 
                userId, 
                conversationId: currentConversationId,
                response: res 
            });
        } else {
            // Para empleados, usar función de streaming específica (si existe)
            streamResult = await processQueryStream({ 
                message, 
                userId, 
                conversationId: currentConversationId,
                response: res 
            });
        }
        
        // Nota: La respuesta ya fue enviada por processQueryStream
        console.log('✅ [STREAM-ROUTE] Stream completado exitosamente');
        
    } catch (error) {
        console.error('❌ [STREAM-ROUTE] Error en streaming:', error);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor en streaming' 
            });
        }
    }
});

// Rutas para empleados
router.post('/employee/chat', isEmployee, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.uid;
        
        // Crear nueva conversación o continuar existente
        const conversationId = await chatManager.createConversation(userId, message);
        
        res.json({ 
            success: true, 
            conversationId,
            message: 'Mensaje guardado correctamente'
        });
    } catch (error) {
        console.error('Error en chat de empleado:', error);
        res.status(500).json({ error: 'Error al procesar el mensaje' });
    }
});

// Rutas para administradores
router.post('/admin/chat', isAdmin, async (req, res) => {
    try {
        const { message, userId } = req.body;
        
        // Verificar si el userId existe
        const userRecord = await admin.auth().getUser(userId);
        if (!userRecord) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const conversationId = await chatManager.createConversation(userId, message);
        
        res.json({ 
            success: true, 
            conversationId,
            message: 'Mensaje guardado correctamente'
        });
    } catch (error) {
        console.error('Error en chat de administrador:', error);
        res.status(500).json({ error: 'Error al procesar el mensaje' });
    }
});

// Obtener historial de conversaciones
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.user.uid;
        const conversations = await chatManager.getUserConversations(userId);
        res.json({ success: true, conversations });
    } catch (error) {
        console.error('Error al obtener conversaciones:', error);
        res.status(500).json({ error: 'Error al obtener el historial de conversaciones' });
    }
});

// Obtener mensajes de una conversación específica
router.get('/conversations/:conversationId', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { conversationId } = req.params;
        
        const messages = await chatManager.getConversationHistory(userId, conversationId);
        res.json({ success: true, messages });
    } catch (error) {
        console.error('Error al obtener mensajes:', error);
        res.status(500).json({ error: 'Error al obtener los mensajes de la conversación' });
    }
});

module.exports = router; 