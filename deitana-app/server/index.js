const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const { processQuery } = require('./openAI');
const { processQuery: processQueryEmployee } = require('./employee/openAIEmployee');
const { verifyToken } = require('./middleware/authMiddleware');

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

// Ruta principal de chat que redirige según el rol
app.post('/api/chat', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.uid;

        console.log('=== INICIO RUTA CHAT ===');
        console.log('Mensaje recibido:', message);
        console.log('Usuario autenticado:', req.user);

        // Procesar según el rol del usuario
        const response = req.user.isAdmin ? 
            await processQuery({ message, userId }) : 
            await processQueryEmployee({ message, userId });

        console.log('Respuesta generada:', response);
        console.log('Enviando respuesta al cliente...');
        res.json(response);
        console.log('=== FIN RUTA CHAT ===');
    } catch (error) {
        console.error('Error en el endpoint de chat:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta para obtener el historial de conversaciones
app.get('/api/conversations', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const conversations = await chatManager.getUserConversations(userId);
        res.json({ success: true, conversations });
    } catch (error) {
        console.error('Error al obtener conversaciones:', error);
        res.status(500).json({ error: 'Error al obtener el historial de conversaciones' });
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