import React, { useState, useRef } from 'react';
import { X, Mic, MicOff } from 'lucide-react';

const VoiceAssistantModal = ({ isOpen, onClose, user, API_URL, currentConversationId, setCurrentConversationId, setChatMessages }) => {
  const [status, setStatus] = useState('Mantén presionado para hablar');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    if (isProcessing) return;
    
    try {
      console.log('🎤 [VOICE] Iniciando grabación');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaStreamRef.current = stream;
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => processAudio();
      
      recorder.start();
      setIsRecording(true);
      setStatus('Grabando... Suelta para enviar');
      console.log('▶️ [VOICE] Grabando');
      
    } catch (error) {
      console.error('❌ [VOICE] Error:', error);
      setStatus('Error: Micrófono no disponible');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('🛑 [VOICE] Detenido');
    }
  };

  const processAudio = async () => {
    if (audioChunksRef.current.length === 0) return;
    
    try {
      setIsProcessing(true);
      setStatus('Procesando...');
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];
      
      // Detener stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      
      console.log('📤 [VOICE] Enviando:', audioBlob.size, 'bytes');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.webm');
      
      const token = await user.getIdToken();
      
      console.log('🔍 [VOICE] Conversation ID actual:', currentConversationId);
      
      // Usar conversationId si existe, sino crear temporal
      const convId = currentConversationId || `temp_${Date.now()}`;
      formData.append('conversationId', convId);
      
      // Llamar al backend que USA openAI.js
      const response = await fetch(`${API_URL}/api/voice-assistant/chat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!response.ok) throw new Error('Error al procesar');
      
      const data = await response.json();
      console.log('✅ [VOICE] Transcripción:', data.transcription);
      console.log('✅ [VOICE] Respuesta:', data.response.substring(0, 100) + '...');
      
      // Actualizar conversationId si es nuevo
      if (data.conversationId && (!currentConversationId || currentConversationId.startsWith('temp_'))) {
        console.log('🔄 [VOICE] Actualizando conversationId:', data.conversationId);
        setCurrentConversationId(data.conversationId);
      }
      
      // Agregar mensajes al chat
      if (setChatMessages) {
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          text: data.transcription,
          sender: 'user',
          isVoice: true
        }]);
        
        setChatMessages(prev => [...prev, {
          id: Date.now() + 1,
          text: data.response,
          sender: 'bot',
          isVoice: true
        }]);
      }
      
      // Reproducir audio
      if (data.audio) {
        setStatus('Reproduciendo...');
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play();
        });
        
        console.log('✅ [VOICE] Completado');
      }
      
      setStatus('Mantén presionado para hablar');
      
    } catch (error) {
      console.error('❌ [VOICE] Error:', error);
      setStatus('Error al procesar');
    } finally {
      setIsProcessing(false);
    }
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
      
      {/* Círculo negro */}
      <div style={{
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: isRecording ? 'pulse 1.5s infinite' : 'none',
        marginBottom: '80px'
      }}>
        {isRecording && <Mic size={48} color="#ffffff" />}
      </div>

      {/* Texto */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '40px',
        color: '#666',
        fontSize: '14px',
        textAlign: 'center',
        maxWidth: '400px'
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
          fontWeight: 'bold',
          flexShrink: 0
        }}>i</span>
        <span>{status}</span>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: '20px' }}>
        
        {/* Botón micrófono */}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={isProcessing}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isRecording ? '#ff4444' : '#000000',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isRecording ? '0 0 20px rgba(255,68,68,0.5)' : '0 2px 8px rgba(0,0,0,0.2)',
            opacity: isProcessing ? 0.5 : 1,
            transform: isRecording ? 'scale(1.1)' : 'scale(1)',
            transition: 'all 0.2s'
          }}
        >
          {isRecording ? (
            <MicOff size={32} color="#fff" strokeWidth={2} />
          ) : (
            <Mic size={32} color="#fff" strokeWidth={2} />
          )}
        </button>

        {/* Botón cerrar */}
        <button
          onClick={onClose}
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
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <X size={24} color="#333" />
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.95; }
        }
      `}</style>
    </div>
  );
};

export default VoiceAssistantModal;
