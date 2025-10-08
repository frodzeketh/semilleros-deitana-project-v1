import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic } from 'lucide-react';

let globalActive = false;

const VoiceAssistantModal = ({ isOpen, onClose, user, API_URL }) => {
  const [status, setStatus] = useState('Conectando...');
  const [isActive, setIsActive] = useState(false);
  
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const audioElRef = useRef(null);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach(s => s.track?.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    
    if (audioElRef.current) {
      if (audioElRef.current.srcObject) {
        audioElRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
      audioElRef.current = null;
    }
    
    setIsActive(false);
    console.log('✅ [VOICE] Limpio');
  }, []);

  const init = useCallback(async () => {
    try {
      if (pcRef.current) return;
      
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      
      const token = await user.getIdToken();
      const res = await fetch(`${API_URL}/api/voice-assistant/session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      const KEY = data.client_secret.value;
      
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElRef.current = audioEl;
      
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      
      pc.addTrack(stream.getTracks()[0]);
      
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      
      dc.onopen = () => {
        console.log('✅ [VOICE] Conectado');
        setStatus('Habla cuando quieras');
        setIsActive(true);
        
        // Cargar información de la empresa desde el backend
        fetch(`${API_URL}/api/chat/company-context`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(r => r.json())
        .then(contextData => {
          // Configurar con información de la empresa
          dc.send(JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: contextData.instructions || `Eres un asistente de Semilleros Deitana, S.L. Responde de manera natural, amigable y profesional con emojis. Usa la información de la empresa cuando sea relevante.`,
              voice: 'shimmer', // Voz femenina
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: { model: 'whisper-1' },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
              },
              tools: [
                {
                  type: 'function',
                  name: 'query_backend',
                  description: 'Consulta información específica de Semilleros Deitana (base de datos, políticas, etc.)',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: { type: 'string', description: 'La consulta a realizar' }
                    },
                    required: ['query']
                  }
                }
              ]
            }
          }));
          
          console.log('✅ [VOICE] Configurado con contexto de empresa');
        });
      };
      
      dc.onmessage = async (e) => {
        const event = JSON.parse(e.data);
        
        // Log de eventos importantes
        if (event.type === 'response.done') {
          console.log('✅ [VOICE] Respuesta completada');
        }
        
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          console.log('📝 [VOICE] Transcripción:', event.transcript);
        }
        
        // Manejar function calling
        if (event.type === 'response.function_call_arguments.done') {
          console.log('🔧 [VOICE] Function call detectada:', event.name);
          console.log('🔍 [VOICE] Arguments:', event.arguments);
          
          setStatus('Consultando información...');
          
          try {
            const args = JSON.parse(event.arguments);
            const token = await user.getIdToken();
            
            console.log('📤 [VOICE] Enviando al backend:', args.query);
            
            const res = await fetch(`${API_URL}/api/chat/process-voice`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ message: args.query })
            });
            
            const data = await res.json();
            
            console.log('✅ [VOICE] Respuesta del backend:', data.response.substring(0, 100) + '...');
            
            // Devolver resultado a Realtime API
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: event.call_id,
                output: data.response
              }
            }));
            
            // Solicitar que genere la respuesta con el resultado
            dc.send(JSON.stringify({ type: 'response.create' }));
            
            setStatus('Habla cuando quieras');
            console.log('✅ [VOICE] Function completada - esperando respuesta de voz');
          } catch (error) {
            console.error('❌ [VOICE] Error en function:', error);
            setStatus('Error - Habla de nuevo');
          }
        }
      };
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      const sdp = await fetch(`https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${KEY}`,
          'Content-Type': 'application/sdp'
        }
      });
      
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdp.text() });
      console.log('✅ [VOICE] WebRTC establecido');
        
      } catch (error) {
      console.error('❌ [VOICE] Error:', error);
      setStatus('Error: ' + error.message);
    }
  }, [user, API_URL]);

  useEffect(() => {
    if (!isOpen || globalActive) return;
    
    globalActive = true;
    console.log('🚀 [VOICE] Iniciando Realtime API');
    init();
    
    return () => {
      console.log('🧹 [VOICE] Cleanup');
        cleanup();
      globalActive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
      
      <div style={{
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: isActive ? 'pulse 1.5s infinite' : 'none',
        marginBottom: '80px'
      }}>
        {isActive && <Mic size={48} color="#fff" />}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '40px',
        color: '#666',
        fontSize: '14px',
        textAlign: 'center',
        maxWidth: '500px'
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

      <button onClick={() => { cleanup(); onClose(); }} style={{
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
      }}>
        <X size={24} color="#333" />
        </button>

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
