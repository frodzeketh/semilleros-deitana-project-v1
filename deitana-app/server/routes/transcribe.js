// server/routes/transcribe.js
const express = require('express');
const multer = require('multer');
const { OpenAI } = require('openai');
const router = express.Router();

// Configurar multer para archivos de audio
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB límite de Whisper
  },
  fileFilter: (req, file, cb) => {
    // Aceptar solo archivos de audio
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de audio'), false);
    }
  }
});

// Inicializar cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Endpoint para transcribir audio usando OpenAI Whisper API
 * POST /api/transcribe
 */
router.post('/', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🎤 [WHISPER] Recibiendo solicitud de transcripción...');
    
    // Verificar que se recibió un archivo
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No se recibió ningún archivo de audio' 
      });
    }
    
    const audioFile = req.file;
    console.log('📁 [WHISPER] Archivo recibido:', {
      originalname: audioFile.originalname,
      mimetype: audioFile.mimetype,
      size: audioFile.size
    });
    
    // Validar tamaño del archivo
    if (audioFile.size > 25 * 1024 * 1024) {
      return res.status(400).json({ 
        error: 'El archivo de audio es demasiado grande (máximo 25MB)' 
      });
    }
    
    // Crear un archivo temporal para OpenAI
    const audioBlob = new Blob([audioFile.buffer], { type: audioFile.mimetype });
    const audioFileObj = new File([audioBlob], audioFile.originalname, {
      type: audioFile.mimetype
    });
    
    console.log('🔄 [WHISPER] Enviando a OpenAI Whisper API...');
    
    // Llamar a OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFileObj,
      model: 'whisper-1',
      language: 'es', // Español
      response_format: 'text'
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ [WHISPER] Transcripción completada:', {
      text: transcription,
      duration: `${duration}ms`,
      cost: `~$${(audioFile.size / (1024 * 1024) * 0.006).toFixed(4)}` // Aproximado
    });
    
    // Retornar el texto transcrito
    res.json({
      text: transcription,
      duration: duration,
      fileSize: audioFile.size
    });
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error('❌ [WHISPER] Error en transcripción:', {
      message: error.message,
      duration: `${duration}ms`
    });
    
    // Manejar errores específicos de OpenAI
    if (error.status === 401) {
      return res.status(401).json({ 
        error: 'Error de autenticación con OpenAI API' 
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({ 
        error: 'Límite de tasa excedido. Intenta de nuevo en unos momentos.' 
      });
    }
    
    if (error.status === 413) {
      return res.status(413).json({ 
        error: 'El archivo de audio es demasiado grande' 
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor al transcribir audio',
      details: error.message
    });
  }
});

module.exports = router;
