// server/routes/voice-assistant.js
const express = require('express');
const multer = require('multer');
const { OpenAI } = require('openai');
const { verifyToken } = require('../middleware/authMiddleware');
const { processQueryStream } = require('../admin/core/openAI');
const chatManager = require('../utils/chatManager');
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
    const { conversationId, image } = req.body;
    const userId = req.user.uid;
    const audioFile = req.file;
    
    console.log('🎙️ [VOICE-CHAT] Iniciando asistente de voz...');
    console.log('🎙️ [VOICE-CHAT] Usuario:', userId);
    console.log('🎙️ [VOICE-CHAT] Conversación ID:', conversationId);
    console.log('🎙️ [VOICE-CHAT] Tiene imagen:', !!image);
    
    if (!audioFile) {
      return res.status(400).json({ 
        error: 'No se recibió archivo de audio' 
      });
    }
    
    // ========================================
    // PASO 1: Transcribir audio con Whisper
    // ========================================
    console.log('🎤 [VOICE-CHAT] Transcribiendo audio...');
    
    const audioBlob = new Blob([audioFile.buffer], { type: audioFile.mimetype });
    const audioFileObj = new File([audioBlob], audioFile.originalname || 'audio.webm', {
      type: audioFile.mimetype
    });
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFileObj,
      model: 'whisper-1',
      language: 'es',
      response_format: 'text'
    });
    
    console.log('✅ [VOICE-CHAT] Transcripción:', transcription);
    
    // ========================================
    // PASO 2: Procesar con el sistema actual
    // ========================================
    let currentConversationId = conversationId;
    
    // Crear nueva conversación si es necesario
    if (!currentConversationId || currentConversationId.startsWith('temp_')) {
      currentConversationId = await chatManager.createConversation(userId, transcription);
      console.log('🆕 [VOICE-CHAT] Nueva conversación creada:', currentConversationId);
    }
    
    // Verificar propiedad de la conversación
    try {
      await chatManager.verifyChatOwnership(userId, currentConversationId);
    } catch (error) {
      return res.status(404).json({
        error: 'Conversación no encontrada'
      });
    }
    
    // Procesar imagen si existe
    let processedMessage = transcription;
    if (image) {
      console.log('🖼️ [VOICE-CHAT] Procesando imagen con OCR...');
      try {
        const { processImageWithOCR } = require('../admin/core/openAI');
        const extractedText = await processImageWithOCR(image);
        
        if (extractedText) {
          const partidaMatch = extractedText.match(/(?:partida|Partida)[:\s]*(\d+)|Número de partida[:\s]*(\d+)|(\d{8,})/i);
          if (partidaMatch) {
            const numeroPartida = partidaMatch[1] || partidaMatch[2] || partidaMatch[3];
            processedMessage = `De quien es esta partida ${numeroPartida}`;
          } else {
            processedMessage = `${transcription}\n\n📷 Información de la imagen:\n${extractedText}`;
          }
        }
      } catch (error) {
        console.error('❌ [VOICE-CHAT] Error procesando imagen:', error);
      }
    }
    
    // Guardar mensaje del usuario
    const userMessage = {
      role: 'user',
      content: processedMessage,
      timestamp: new Date().toISOString(),
      hasImage: !!image,
      isVoice: true
    };
    
    await chatManager.addMessageToConversation(userId, currentConversationId, userMessage);
    
    // Procesar consulta y obtener respuesta
    console.log('🤖 [VOICE-CHAT] Procesando consulta con el sistema actual...');
    
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
          console.log('📋 [VOICE-CHAT] writeHead llamado:', statusCode);
          mockResponse.statusCode = statusCode;
          return mockResponse;
        },
        
        setHeader: (name, value) => {
          console.log('📋 [VOICE-CHAT] setHeader:', name);
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
          console.log('📦 [VOICE-CHAT] Chunk recibido:', data.substring(0, 100));
          
          try {
            // Intentar parsear como JSON directamente
            const jsonData = JSON.parse(data);
            console.log('📋 [VOICE-CHAT] Chunk parseado:', jsonData.type);
            
            // Capturar diferentes tipos de chunks
            if (jsonData.type === 'chunk' && jsonData.content) {
              // Chunks de contenido parcial
              fullResponse += jsonData.content;
              console.log('✅ [VOICE-CHAT] Chunk agregado. Total acumulado:', fullResponse.length, 'chars');
            } else if (jsonData.type === 'content' && jsonData.text) {
              // Chunks de contenido (formato alternativo)
              fullResponse += jsonData.text;
              console.log('✅ [VOICE-CHAT] Texto agregado. Total acumulado:', fullResponse.length, 'chars');
            } else if (jsonData.type === 'end' && jsonData.fullResponse) {
              // Chunk final con la respuesta completa
              fullResponse = jsonData.fullResponse;
              console.log('✅ [VOICE-CHAT] Respuesta completa recibida:', fullResponse.length, 'chars');
            } else if (jsonData.type === 'error') {
              hasError = true;
              errorMessage = jsonData.message || 'Error desconocido';
              console.error('❌ [VOICE-CHAT] Error en chunk:', errorMessage);
            } else {
              console.log('ℹ️ [VOICE-CHAT] Chunk de tipo:', jsonData.type, '(ignorado)');
            }
          } catch (e) {
            // Si no es JSON válido, intentar con formato SSE
            if (data.startsWith('data: ')) {
              try {
                const jsonData = JSON.parse(data.substring(6));
                if (jsonData.type === 'content' && jsonData.text) {
                  fullResponse += jsonData.text;
                }
              } catch (e2) {
                console.log('📝 [VOICE-CHAT] Chunk no es JSON válido, ignorando');
              }
            }
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
          console.log('📋 [VOICE-CHAT] json() llamado');
          return mockResponse;
        },
        
        status: (code) => {
          mockResponse.statusCode = code;
          return mockResponse;
        },
        
        send: (data) => {
          console.log('📋 [VOICE-CHAT] send() llamado');
          return mockResponse;
        }
      };
      
      // Usar el sistema actual de procesamiento con el response mock
      await processQueryStream({
        message: processedMessage,
        userId,
        conversationId: currentConversationId,
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
    
    // Nota: No guardamos el mensaje del asistente aquí porque processQueryStream ya lo guarda
    
    // Responder con JSON que incluye todo
    res.json({
      conversationId: currentConversationId,
      transcription: transcription,
      response: fullResponse,
      audio: audioBuffer.toString('base64'), // Audio en base64
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
