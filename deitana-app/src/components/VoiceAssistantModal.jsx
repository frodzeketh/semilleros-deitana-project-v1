import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Volume2 } from 'lucide-react';
import { initializeAudioContext, playVoiceResponse } from './VoiceAssistantFunctions';

const VoiceAssistantModal = ({ isOpen, onClose, user, currentConversationId, setCurrentConversationId, API_URL }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState(null);
  
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const currentAudioRef = useRef(null);
  const recognitionTimeoutRef = useRef(null);

  // Inicializar AudioContext al abrir el modal
  useEffect(() => {
    const initAudioSystem = async () => {
      try {
        console.log('🎤 [MODAL] Inicializando sistema de audio...');
        
        // Inicializar AudioContext
        const ctx = await initializeAudioContext();
        if (ctx) {
          audioContextRef.current = ctx;
          console.log('✅ [MODAL] AudioContext listo');
        }
        
        // Reproducir silencio para desbloquear audio en Safari iOS
        const warmAudio = new Audio();
        const silenceDataUrl = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////////////////////////////////////////////////////////////////////AAAAAExhdmM1OC4xMzQAAAAAAAAAAAAAAAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZEwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
        warmAudio.src = silenceDataUrl;
        warmAudio.volume = 0;
        warmAudio.playsInline = true;
        await warmAudio.play().catch(e => console.log('⚠️ Warm audio:', e.message));
        
        console.log('✅ [MODAL] Sistema de audio desbloqueado');
        
        // Iniciar escucha automática
        startListening();
        
      } catch (error) {
        console.error('❌ [MODAL] Error inicializando audio:', error);
        setError('No se pudo inicializar el sistema de audio');
      }
    };

    if (isOpen && !audioContextRef.current) {
      initAudioSystem();
    }
    
    return () => {
      // Cleanup al cerrar
      if (!isOpen) {
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startListening = async () => {
    try {
      console.log('🎤 [MODAL] Iniciando escucha...');
      setIsListening(true);
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        console.log('🛑 [MODAL] Grabación detenida');
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        if (audioBlob.size > 1000) {
          await processVoice(audioBlob);
        }
      };
      
      recorder.start();
      mediaRecorderRef.current = recorder;
      
      // Auto-detener después de 10 segundos
      recognitionTimeoutRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          console.log('⏱️ [MODAL] Tiempo límite, deteniendo...');
          recorder.stop();
        }
      }, 10000);
      
    } catch (error) {
      console.error('❌ [MODAL] Error al iniciar micrófono:', error);
      setError('No se pudo acceder al micrófono');
      setIsListening(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }
    setIsListening(false);
  };

  const processVoice = async (audioBlob) => {
    try {
      setIsProcessing(true);
      setIsListening(false);
      console.log('🔄 [MODAL] Procesando voz...');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-input.webm');
      formData.append('conversationId', currentConversationId || '');
      
      const response = await fetch(`${API_URL}/api/voice-assistant/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Error al procesar la voz');
      }
      
      const data = await response.json();
      console.log('✅ [MODAL] Respuesta recibida:', data);
      
      if (data.conversationId) {
        setCurrentConversationId(data.conversationId);
      }
      
      setTranscript(data.transcription);
      setResponse(data.response);
      
      // Reproducir respuesta de voz
      if (data.audio) {
        setIsSpeaking(true);
        await playVoiceResponse(data.audio, audioContextRef.current, setIsSpeaking, (audio) => {
          currentAudioRef.current = audio;
        });
        setIsSpeaking(false);
      }
      
      // Esperar un momento y volver a escuchar
      setTimeout(() => {
        if (isOpen) {
          startListening();
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ [MODAL] Error procesando voz:', error);
      setError(error.message);
      
      // Reintentar escucha
      setTimeout(() => {
        if (isOpen) {
          startListening();
        }
      }, 1000);
    } finally {
      setIsProcessing(false);
    }
  };

  const cleanup = () => {
    console.log('🧹 [MODAL] Limpiando recursos...');
    
    // Detener grabación
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Detener audio
    if (currentAudioRef.current) {
      if (currentAudioRef.current.pause) currentAudioRef.current.pause();
      if (currentAudioRef.current.stop) currentAudioRef.current.stop();
    }
    
    // Cerrar AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Limpiar timeouts
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '40px'
    }}>
      
      {/* Círculo negro central */}
      <div style={{
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: isListening || isSpeaking ? 'pulse 1.5s ease-in-out infinite' : 'none',
        marginBottom: '120px'
      }}>
        {/* Sin ícono dentro - círculo negro sólido como en la imagen */}
      </div>

      {/* Texto informativo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '40px',
        color: '#666',
        fontSize: '14px'
      }}>
        <span style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '2px solid #999',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          i
        </span>
        <span>
          {isListening ? 'Escuchando...' : 
           isSpeaking ? 'Hablando...' : 
           isProcessing ? 'Procesando...' :
           'Enable microphone access in Settings'}
        </span>
      </div>

      {/* Botones de control */}
      <div style={{
        display: 'flex',
        gap: '20px'
      }}>
        {/* Botón mutear micrófono */}
        <button
          onClick={() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
              setIsListening(false);
            }
          }}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#ffe5e5',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: 'none'
          }}
          title="Mutear micrófono"
        >
          <div style={{ position: 'relative' }}>
            <Mic size={24} color="#ff4444" strokeWidth={2} />
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '-4px',
              right: '-4px',
              height: '2px',
              backgroundColor: '#ff4444',
              transform: 'rotate(-45deg)',
              transformOrigin: 'center'
            }}></div>
          </div>
        </button>

        {/* Botón cerrar */}
        <button
          onClick={handleClose}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#f5f5f5',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: 'none'
          }}
          title="Cerrar asistente"
        >
          <X size={24} color="#333" strokeWidth={2} />
        </button>
      </div>

      {/* Estilos para animaciones */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.95;
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VoiceAssistantModal;

