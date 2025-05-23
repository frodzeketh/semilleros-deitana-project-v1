const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const { processQuery, resetContext } = require('./openAI');

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
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        // Verificar si es una nueva conexión
        if (message === 'NUEVA_CONEXION') {
            resetContext();
            return res.json({
                success: true,
                data: {
                    message: "¡Hola! Soy Deitana IA, tu asistente virtual. ¿En qué puedo ayudarte hoy?"
                }
            });
        }

        const response = await processQuery(message);
        res.json(response);
    } catch (error) {
        console.error('Error al procesar el mensaje:', error);
        res.status(500).json({
            success: false,
            error: 'Error al procesar el mensaje'
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