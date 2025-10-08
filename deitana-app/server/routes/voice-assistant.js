// server/routes/voice-assistant.js
const express = require('express');
const multer = require('multer');
const { OpenAI } = require('openai');
const { verifyToken } = require('../middleware/authMiddleware');
const { processQueryStream } = require('../admin/core/openAI');
const chatManager = require('../utils/chatManager');
const fs = require('fs');
const path = require('path');
const os = require('os');
const router = express.Router();

// Middleware de autenticación
router.use(verifyToken);

// Configurar multer para archivos de audio
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB límite de Whisper
  },
  fileFilter: (req, file, cb) => {
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
 * Endpoint para obtener sesión de Realtime API
 * POST /api/voice-assistant/session
 */
router.post('/session', async (req, res) => {
  try {
    console.log('🔑 [SESSION] Generando ephemeral token para Realtime API...');
    
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [SESSION] Error:', error);
      throw new Error('No se pudo crear sesión');
    }
    
    const data = await response.json();
    console.log('✅ [SESSION] Token generado');
    
    res.json(data);
    
  } catch (error) {
    console.error('❌ [SESSION] Error:', error);
    res.status(500).json({ 
      error: 'Error al crear sesión',
      details: error.message
    });
  }
});

/**
 * Endpoint para convertir texto a voz usando OpenAI TTS con voz Alloy
 * POST /api/voice-assistant/tts
 */
router.post('/tts', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text } = req.body;
    
    console.log('🔊 [TTS] Generando audio con voz Alloy...');
    console.log('🔊 [TTS] Texto:', text?.substring(0, 100) + '...');
    
    if (!text) {
      return res.status(400).json({ 
        error: 'Se requiere el parámetro "text"' 
      });
    }
    
    // Generar audio con OpenAI TTS usando voz Alloy
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1', // Modelo de TTS más rápido
      voice: 'alloy', // Voz Alloy natural
      input: text,
      speed: 1.0 // Velocidad normal
    });
    
    // Convertir a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ [TTS] Audio generado:', {
      size: buffer.length,
      duration: `${duration}ms`,
      textLength: text.length
    });
    
    // Enviar el audio como respuesta
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache'
    });
    
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ [TTS] Error al generar audio:', error);
    res.status(500).json({ 
      error: 'Error al generar audio',
      details: error.message
    });
  }
});

/**
 * Endpoint para asistente de voz completo:
 * - Recibe audio del usuario
 * - Transcribe con Whisper
 * - Procesa con el sistema RAG/SQL actual
 * - Responde con voz Alloy
 * POST /api/voice-assistant/chat
 */
router.post('/chat', upload.single('audio'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const audioFile = req.file;
    const conversationId = req.body.conversationId; // ← RECIBIR conversationId
    
    console.log('🎙️ [VOICE-CHAT] Iniciando asistente de voz...');
    console.log('🔍 [VOICE-CHAT] Conversation ID:', conversationId);
    
    if (!audioFile) {
      return res.status(400).json({ 
        error: 'No se recibió archivo de audio' 
      });
    }
    
    // ========================================
    // PASO 1: Transcribir audio con Whisper
    // ========================================
    console.log('🎤 [VOICE-CHAT] Transcribiendo audio...');
    
    // Crear archivo temporal para OpenAI (necesario en Node.js)
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `voice-${Date.now()}.webm`);
    
    // Escribir el buffer a un archivo temporal
    fs.writeFileSync(tempFilePath, audioFile.buffer);
    
    let transcription;
    try {
      // Crear un stream de lectura para OpenAI
      const audioStream = fs.createReadStream(tempFilePath);
      
      transcription = await openai.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        language: 'es',
        response_format: 'text'
      });
      
      // Limpiar archivo temporal
      fs.unlinkSync(tempFilePath);
    } catch (error) {
      // Asegurarse de limpiar el archivo incluso si hay error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw error;
    }
    
    console.log('✅ [VOICE-CHAT] Transcripción:', transcription);
    
    // ========================================
    // PASO 2: Procesar con el sistema actual (MEMORIA RAM)
    // ========================================
    
    // Procesar consulta y obtener respuesta usando MEMORIA RAM
    console.log('🤖 [VOICE-CHAT] Procesando consulta con memoria RAM...');
    
    let fullResponse = '';
    let hasError = false;
    let errorMessage = '';
    
    try {
      // Crear un objeto response mock que capture los chunks
      const mockResponse = {
        headersSent: false,
        finished: false,
        statusCode: 200,
        statusMessage: 'OK',
        
        // Métodos requeridos por Express/Node.js HTTP response
        writeHead: (statusCode, headers) => {
          mockResponse.statusCode = statusCode;
          return mockResponse;
        },
        
        setHeader: (name, value) => {
          return mockResponse;
        },
        
        getHeader: (name) => {
          return undefined;
        },
        
        removeHeader: (name) => {
          return mockResponse;
        },
        
        write: (chunk) => {
          // Capturar los chunks que se van escribiendo
          const data = chunk.toString();
          
          try {
            // Intentar parsear como JSON directamente
            const jsonData = JSON.parse(data);
            
            // Capturar diferentes tipos de chunks
            if (jsonData.type === 'chunk' && jsonData.content) {
              // Chunks de contenido parcial
              fullResponse += jsonData.content;
            } else if (jsonData.type === 'error') {
              hasError = true;
              errorMessage = jsonData.message || 'Error desconocido';
              console.error('❌ [VOICE-CHAT] Error en chunk:', errorMessage);
            }
          } catch (e) {
            // Ignorar chunks no parseables
          }
          return true;
        },
        
        end: (data, encoding, callback) => {
          console.log('📝 [VOICE-CHAT] Streaming finalizado');
          mockResponse.finished = true;
          if (typeof data === 'function') {
            data();
          } else if (typeof encoding === 'function') {
            encoding();
          } else if (typeof callback === 'function') {
            callback();
          }
          return mockResponse;
        },
        
        // Métodos adicionales que podrían ser necesarios
        json: (data) => {
          return mockResponse;
        },
        
        status: (code) => {
          mockResponse.statusCode = code;
          return mockResponse;
        },
        
        send: (data) => {
          return mockResponse;
        }
      };
      
      // Usar el sistema actual de procesamiento con conversationId
      await processQueryStream({
        message: transcription,
        conversationId: conversationId || `temp_${Date.now()}`, // ← PASAR conversationId
        response: mockResponse
      });
      
    } catch (error) {
      console.error('❌ [VOICE-CHAT] Error al procesar consulta:', error);
      hasError = true;
      errorMessage = error.message;
    }
    
    if (hasError) {
      return res.status(500).json({
        error: 'Error al procesar la consulta',
        details: errorMessage
      });
    }
    
    if (!fullResponse || fullResponse.trim().length === 0) {
      fullResponse = 'No pude generar una respuesta. Por favor, intenta de nuevo.';
    }
    
    console.log('✅ [VOICE-CHAT] Respuesta generada:', fullResponse.substring(0, 100) + '...');
    
    // ========================================
    // PASO 3: Convertir respuesta a voz con Alloy
    // ========================================
    console.log('🔊 [VOICE-CHAT] Generando audio con voz Alloy...');
    
    // Limitar el texto para TTS (máximo 4096 caracteres para OpenAI TTS)
    const textForTTS = fullResponse.length > 4096 
      ? fullResponse.substring(0, 4093) + '...' 
      : fullResponse;
    
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: textForTTS,
      speed: 1.0
    });
    
    const audioBuffer = Buffer.from(await mp3.arrayBuffer());
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ [VOICE-CHAT] Proceso completo:', {
      duration: `${duration}ms`,
      transcription: transcription,
      responseLength: fullResponse.length,
      audioSize: audioBuffer.length
    });
    
    // Responder con JSON que incluye todo + conversationId
    res.json({
      transcription: transcription,
      response: fullResponse,
      audio: audioBuffer.toString('base64'), // Audio en base64
      conversationId: conversationId || `temp_${Date.now()}`, // ← DEVOLVER conversationId
      duration: duration
    });
    
  } catch (error) {
    console.error('❌ [VOICE-CHAT] Error general:', error);
    res.status(500).json({ 
      error: 'Error en el asistente de voz',
      details: error.message
    });
  }
});

/**
 * Endpoint simplificado para TTS rápido (sin todo el procesamiento)
 * POST /api/voice-assistant/speak
 */
router.post('/speak', async (req, res) => {
  try {
    const { text, voice = 'alloy', speed = 1.0 } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Se requiere texto' });
    }
    
    console.log('🔊 [SPEAK] Generando audio:', text.substring(0, 50) + '...');
    
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
      speed: speed
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length
    });
    
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ [SPEAK] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
