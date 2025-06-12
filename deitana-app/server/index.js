// Importar Firebase Admin primero
require('./firebase-admin');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const { processQuery } = require('./openAI');
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

// Ruta para crear nueva conversación
app.post('/chat/new', verifyToken, async (req, res) => {
  try {
    console.log('=== INICIO CREACIÓN DE CONVERSACIÓN ===');
    console.log('Body recibido:', req.body);
    console.log('Usuario autenticado:', req.user);

    const { message } = req.body;
    if (!message) {
      throw new Error('El mensaje es requerido');
    }

    const conversationId = await chatManager.createConversation(req.user.uid, message);
    console.log('Nueva conversación creada con ID:', conversationId);
    console.log('=== FIN CREACIÓN DE CONVERSACIÓN ===');

    res.json({ 
      success: true, 
      data: { 
        conversationId,
        message: 'Conversación creada exitosamente'
      }
    });
  } catch (error) {
    console.error('Error al crear conversación:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Error al crear conversación',
      details: error.message 
    });
  }
});

// Ruta para procesar mensajes
app.post('/chat', verifyToken, async (req, res) => {
    try {
    console.log('=== INICIO PROCESAMIENTO DE MENSAJE ===');
    console.log('Body recibido:', req.body);
    console.log('Usuario autenticado:', req.user);

    const { message, conversationId } = req.body;
    if (!message) {
      throw new Error('El mensaje es requerido');
    }

    // Guardar mensaje del usuario
    console.log('Guardando mensaje del usuario...');
    await chatManager.addMessageToConversation(req.user.uid, conversationId, {
      role: 'user',
      content: message
    });

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

    console.log('=== FIN PROCESAMIENTO DE MENSAJE ===');
    res.json({ 
                success: true,
                data: {
        message: response.data.message,
        conversationId 
      }
    });
    } catch (error) {
    console.error('Error en el chat:', error);
    console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
      error: 'Error en el procesamiento del mensaje',
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