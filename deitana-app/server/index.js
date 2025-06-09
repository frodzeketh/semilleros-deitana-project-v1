const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const { processQuery: processQueryAdmin } = require('./openAI');
const { processQuery: processQueryEmployee } = require('./openAIEmployee');
const authMiddleware = require('./middleware/authMiddleware');

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

// Ruta para procesar mensajes
app.post('/api/chat', authMiddleware, async (req, res) => {
    try {
        const { message } = req.body;
        
        // Verificar si es un mensaje de nueva conexión
        if (message === 'NUEVA_CONEXION') {
            return res.json({
                success: true,
                data: {
                    message: '¡Hola! Soy el asistente virtual de Semilleros Deitana. ¿En qué puedo ayudarte hoy?'
                }
            });
        }

        // Procesar la consulta según el rol del usuario
        const response = req.user.isAdmin ? 
            await processQueryAdmin(message) : 
            await processQueryEmployee(message);

        res.json(response);
    } catch (error) {
        console.error('Error en el endpoint de chat:', error);
        res.status(500).json({
            success: false,
            error: 'Error al procesar la consulta'
        });
    }
});

// Para cualquier otra ruta, servir el index.html del frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});