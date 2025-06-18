// Importar Firebase Admin primero
require('./firebase-admin');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const { processQuery } = require('./admin/openAI');
const { processQuery: processQueryEmployee } = require('./employee/openAIEmployee');
const { verifyToken } = require('./middleware/authMiddleware');
const chatManager = require('./utils/chatManager');

dotenv.config();

// Comentar logs excesivos de variables de entorno
// console.log('=== VERIFICACIÓN DE VARIABLES DE ENTORNO ===');
// console.log('OPENAI_API_KEY configurada:', process.env.OPENAI_API_KEY ? 'Sí' : 'No');
// console.log('PORT configurado:', process.env.PORT || 'No (usando 3001 por defecto)');
// console.log('=== FIN DE VERIFICACIÓN ===');

const app = express();

// Configuración de CORS más permisiva para desarrollo
app.use(cors({
  origin: '*',  // En producción, cambiar esto a los orígenes específicos
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(bodyParser.json());

// Comentar middleware de logging excesivo
// app.use((req, res, next) => {
//     console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
//     console.log('Headers:', req.headers);
//     console.log('Body:', req.body);
//     next();
// });

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../build')));

// Middleware para verificar si es empleado
const isEmployee = (req, res, next) => {
    if (!req.user.isAdmin) {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Esta ruta es solo para empleados.' });
    }
};

// Middleware para verificar si es admin
const isAdmin = (req, res, next) => {
    if (req.user.isAdmin) {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Esta ruta es solo para administradores.' });
    }
};

// Ruta de prueba
app.get('/test', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

// Ruta para obtener conversaciones
app.get('/conversations', verifyToken, async (req, res) => {
  try {
    const conversations = await chatManager.getConversations(req.user.uid);
    
    res.json({ success: true, data: conversations });
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener conversaciones',
      details: error.message 
    });
  }
});

// Ruta para obtener los mensajes de una conversación
app.get('/conversations/:conversationId/messages', verifyToken, async (req, res) => {
  try {
    // Verificar que el usuario es propietario del chat
    await chatManager.verifyChatOwnership(req.user.uid, req.params.conversationId);

    const messages = await chatManager.getConversationMessages(req.user.uid, req.params.conversationId);

    res.json({ 
      success: true, 
      data: messages 
    });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener los mensajes',
      details: error.message 
    });
  }
});

// Ruta para crear una nueva conversación
app.post('/chat/new', verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      throw new Error('El mensaje es requerido');
    }

    // Si el mensaje es NUEVA_CONEXION, solo devolvemos un ID temporal
    if (message === 'NUEVA_CONEXION') {
      return res.json({ 
        success: true, 
        data: { 
          conversationId: 'temp_' + Date.now(),
          message: 'Hola, soy Deitana IA. ¿En qué puedo ayudarte hoy?'
        }
      });
    }

    // Crear nueva conversación solo si hay un mensaje real
    const conversationId = await chatManager.createConversation(req.user.uid, message);
    if (!conversationId) {
      throw new Error('No se pudo crear la conversación');
    }

    // Procesar respuesta según el rol
    let response;
    if (req.user.isAdmin) {
      response = await processQuery({ message, userId: req.user.uid });
    } else {
      response = await processQueryEmployee({ message, userId: req.user.uid });
    }

    // Guardar respuesta del asistente
    await chatManager.addMessageToConversation(req.user.uid, conversationId, {
      role: 'assistant',
      content: response.data.message
    });

    res.json({ 
      success: true, 
      data: { 
        conversationId,
        message: response.data.message
      }
    });
  } catch (error) {
    console.error('Error al crear nueva conversación:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al crear la conversación',
      details: error.message 
    });
  }
});

// Ruta para procesar mensajes
app.post('/chat', verifyToken, async (req, res) => {
    try {
        const { message, conversationId } = req.body;
        const userId = req.user.uid;
        const isAdmin = req.user.isAdmin;

        console.log('Mensaje:', { role: 'user', content: message });

        let currentConversationId = conversationId;

        // Si no hay conversación o es temporal, crear una nueva
        if (!currentConversationId || currentConversationId.startsWith('temp_')) {
            currentConversationId = await chatManager.createConversation(userId, message);
        }

        // Verificar que la conversación existe
        try {
            await chatManager.verifyChatOwnership(userId, currentConversationId);
        } catch (error) {
            console.error('Error al verificar la conversación:', error);
            return res.status(404).json({
                success: false,
                error: 'Conversación no encontrada'
            });
        }

        // Agregar mensaje del usuario
        await chatManager.addMessageToConversation(userId, currentConversationId, {
            role: 'user',
            content: message
        });

        // Procesar la consulta según el rol
        let response;
        if (isAdmin) {
            response = await processQuery({ message, userId, conversationId: currentConversationId });
        } else {
            response = await processQueryEmployee({ message, userId, conversationId: currentConversationId });
        }

        // Agregar respuesta del asistente
        await chatManager.addMessageToConversation(userId, currentConversationId, {
            role: 'assistant',
            content: response.data.message
        });

        res.json({
            success: true,
            data: {
                message: response.data.message,
                conversationId: currentConversationId
            }
        });
    } catch (error) {
        console.error('Error al procesar mensaje:', error);
        res.status(500).json({
            success: false,
            error: 'Error al procesar el mensaje',
            details: error.message
        });
    }
});

// Para cualquier otra ruta, servir el index.html del frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});