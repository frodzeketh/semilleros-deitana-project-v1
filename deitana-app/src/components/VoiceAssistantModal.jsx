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
    if (isOpen && !audioContextRef.current) {
      initAudioSystem();
    }
    
    return () => {
      // Cleanup al cerrar
      if (!isOpen) {
        cleanup();
      }
    };
  }, [isOpen]);

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
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Botón cerrar */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={24} color="#666" />
        </button>

        {/* Título */}
        <h2 style={{
          margin: '0 0 24px 0',
          fontSize: '24px',
          fontWeight: '600',
          color: '#1a1a1a',
          textAlign: 'center'
        }}>
          Asistente de Voz
        </h2>

        {/* Indicador visual */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          marginBottom: '24px'
        }}>
          {/* Círculo animado */}
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: isListening ? '#10a37f' : (isSpeaking ? '#0066cc' : '#f3f4f6'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: isListening || isSpeaking ? 'pulse 1.5s ease-in-out infinite' : 'none',
            transition: 'background-color 0.3s ease'
          }}>
            {isListening ? (
              <Mic size={48} color="white" />
            ) : isSpeaking ? (
              <Volume2 size={48} color="white" />
            ) : (
              <Mic size={48} color="#666" />
            )}
          </div>

          {/* Estado */}
          <div style={{
            fontSize: '16px',
            fontWeight: '500',
            color: '#666',
            textAlign: 'center'
          }}>
            {isProcessing ? 'Procesando...' : 
             isListening ? 'Escuchando...' : 
             isSpeaking ? 'Hablando...' : 
             'Listo'}
          </div>
        </div>

        {/* Transcripción */}
        {transcript && (
          <div style={{
            padding: '16px',
            backgroundColor: '#f3f4f6',
            borderRadius: '12px',
            marginBottom: '12px'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              Tú dijiste:
            </div>
            <div style={{ fontSize: '14px', color: '#1a1a1a' }}>
              {transcript}
            </div>
          </div>
        )}

        {/* Respuesta */}
        {response && (
          <div style={{
            padding: '16px',
            backgroundColor: '#10a37f10',
            borderRadius: '12px',
            marginBottom: '12px'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              Respuesta:
            </div>
            <div style={{ fontSize: '14px', color: '#1a1a1a' }}>
              {response}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fee',
            borderRadius: '8px',
            color: '#c00',
            fontSize: '14px',
            marginBottom: '12px'
          }}>
            {error}
          </div>
        )}

        {/* Instrucciones */}
        <div style={{
          fontSize: '13px',
          color: '#999',
          textAlign: 'center',
          marginTop: '16px'
        }}>
          Habla naturalmente. El asistente te responderá con voz.
        </div>
      </div>

      {/* Estilos para la animación */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceAssistantModal;

