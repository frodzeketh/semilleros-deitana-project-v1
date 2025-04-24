const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { processMessage } = require('./utils/deepseek');

dotenv.config();

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
  next();
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({ message: 'API de Semilleros Deitana funcionando correctamente' });
});

// Ruta del chat
app.post('/api/chat', async (req, res) => {
  console.log('Recibida petición de chat:', req.body);
  
  const { message } = req.body;
  
  if (!message) {
    console.log('Error: Mensaje vacío');
    return res.status(400).json({ 
      success: false,
      error: 'El mensaje es requerido' 
    });
  }

  try {
    console.log('Procesando mensaje:', message);
    const response = await processMessage(message);
    console.log('Respuesta generada:', response);
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error en el chat:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error procesando el mensaje',
      details: error.message 
    });
  }
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});