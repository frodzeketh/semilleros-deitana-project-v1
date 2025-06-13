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

// Verificación de variables de entorno
console.log('=== VERIFICACIÓN DE VARIABLES DE ENTORNO ===');
console.log('OPENAI_API_KEY configurada:', process.env.OPENAI_API_KEY ? 'Sí' : 'No');
console.log('PORT configurado:', process.env.PORT || 'No (usando 3001 por defecto)');
console.log('=== FIN DE VERIFICACIÓN ===');

const app = express();

// Configuración de CORS más permisiva para desarrollo
app.use(cors({
  origin: '*',  // En producción, cambiar esto a los orígenes específicos
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(bodyParser.json());

// Middleware para logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

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
    console.log('=== INICIO OBTENCIÓN DE CONVERSACIONES ===');
    console.log('Usuario autenticado:', req.user);
    
    const conversations = await chatManager.getConversations(req.user.uid);
    
    console.log('Conversaciones obtenidas:', conversations);
    console.log('=== FIN OBTENCIÓN DE CONVERSACIONES ===');
    
    res.json({ success: true, data: conversations });
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    console.error('Stack trace:', error.stack);
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
    console.log('=== INICIO OBTENCIÓN DE MENSAJES ===');
    console.log('Conversación:', req.params.conversationId);
    console.log('Usuario:', req.user.uid);

    // Verificar que el usuario es propietario del chat
    await chatManager.verifyChatOwnership(req.user.uid, req.params.conversationId);

    const messages = await chatManager.getConversationMessages(req.user.uid, req.params.conversationId);
    console.log('Mensajes obtenidos:', messages);

    console.log('=== FIN OBTENCIÓN DE MENSAJES ===');
    res.json({ 
      success: true, 
      data: messages 
    });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    console.error('Stack trace:', error.stack);
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
    console.log('=== INICIO CREACIÓN DE NUEVA CONVERSACIÓN ===');
    console.log('Body recibido:', req.body);
    console.log('Usuario autenticado:', req.user);

    const { message } = req.body;
    if (!message) {
      throw new Error('El mensaje es requerido');
    }

    // Si el mensaje es NUEVA_CONEXION, solo devolvemos un ID temporal
    if (message === 'NUEVA_CONEXION') {
      console.log('Mensaje inicial es NUEVA_CONEXION, devolviendo ID temporal');
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
    console.log('Procesando respuesta según rol:', req.user.isAdmin);
    let response;
    if (req.user.isAdmin) {
      response = await processQuery({ message, userId: req.user.uid });
    } else {
      response = await processQueryEmployee({ message, userId: req.user.uid });
    }

    // Guardar respuesta del asistente
    console.log('Guardando respuesta del asistente...');
    await chatManager.addMessageToConversation(req.user.uid, conversationId, {
      role: 'assistant',
      content: response.data.message
    });

    console.log('=== FIN CREACIÓN DE NUEVA CONVERSACIÓN ===');
    res.json({ 
      success: true, 
      data: { 
        conversationId,
        message: response.data.message
      }
    });
  } catch (error) {
    console.error('Error al crear nueva conversación:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Error al crear la conversación',
      details: error.message 
    });
  }
});

// Ruta para procesar mensajes
app.post('/chat', async (req, res) => {
    try {
        const { message, conversationId } = req.body;
        const userId = req.user.uid;
        const isAdmin = req.user.isAdmin;

        console.log('Mensaje:', message);
        console.log('Usuario:', userId);
        console.log('Es admin:', isAdmin);
        console.log('Conversación:', conversationId);

        let currentConversationId = conversationId;

        // Si no hay conversación o es temporal, crear una nueva
        if (!currentConversationId || currentConversationId.startsWith('temp_')) {
            console.log('Creando nueva conversación...');
            currentConversationId = await chatManager.createConversation(userId, message);
            console.log('Nueva conversación creada:', currentConversationId);
        }

        // Verificar que la conversación existe
        try {
            await chatManager.verifyChatOwnership(userId, currentConversationId);
        } catch (error) {
            console.log('Conversación no encontrada, creando nueva...');
            currentConversationId = await chatManager.createConversation(userId, message);
        }

        // Agregar mensaje del usuario
        await chatManager.addMessageToConversation(userId, currentConversationId, {
            role: 'user',
            content: message
        });

        // Procesar la consulta según el rol
        let response;
        if (isAdmin) {
            response = await processQuery({ message, userId });
        } else {
            response = await processQueryEmployee({ message, userId });
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
        console.error('Error en el chat:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            data: {
                message: 'Lo siento, ha ocurrido un error al procesar tu consulta. Por favor, intenta reformular tu pregunta o contacta con soporte si el problema persiste.'
            }
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