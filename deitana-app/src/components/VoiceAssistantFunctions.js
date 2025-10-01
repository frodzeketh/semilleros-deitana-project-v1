// VoiceAssistantFunctions.js
// Funciones del asistente de voz multimodal con soporte completo para Safari/iOS

/**
 * Inicializar y desbloquear AudioContext
 * IMPORTANTE: Debe llamarse durante una interacción del usuario (click/tap)
 */
export const initializeAudioContext = async () => {
  try {
    // Crear AudioContext (compatible con Safari)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      console.warn('⚠️ [VOICE-ASSISTANT] AudioContext no soportado en este navegador')
      return null
    }
    
    const ctx = new AudioContextClass()
    console.log('✅ [VOICE-ASSISTANT] AudioContext creado, estado:', ctx.state)
    
    // Desbloquear AudioContext si está suspendido (Safari iOS)
    if (ctx.state === 'suspended') {
      await ctx.resume()
      console.log('✅ [VOICE-ASSISTANT] AudioContext resumido')
    }
    
    // Reproducir silencio para desbloquear completamente (Safari iOS)
    const silentBuffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = silentBuffer
    source.connect(ctx.destination)
    source.start(0)
    
    console.log('✅ [VOICE-ASSISTANT] AudioContext desbloqueado completamente')
    return ctx
    
  } catch (error) {
    console.error('❌ [VOICE-ASSISTANT] Error al inicializar AudioContext:', error)
    return null
  }
}

/**
 * Reproducir audio usando Web Audio API (mejor para Safari/iOS)
 */
export const playAudioWithWebAudioAPI = async (audioBase64, audioContext, setIsSpeaking, setCurrentAudio) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!audioBase64) {
        console.error('❌ [VOICE-ASSISTANT] No hay audio para reproducir')
        resolve()
        return
      }
      
      console.log('🔊 [VOICE-ASSISTANT] Reproduciendo con Web Audio API...')
      setIsSpeaking(true)
      
      // Convertir base64 a ArrayBuffer
      const audioData = atob(audioBase64)
      const arrayBuffer = new ArrayBuffer(audioData.length)
      const view = new Uint8Array(arrayBuffer)
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i)
      }
      
      console.log('✅ [VOICE-ASSISTANT] Audio decodificado:', arrayBuffer.byteLength, 'bytes')
      
      // Asegurar que el AudioContext esté activo
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      // Decodificar el audio MP3 a AudioBuffer
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      console.log('✅ [VOICE-ASSISTANT] Audio buffer creado, duración:', audioBuffer.duration, 'segundos')
      
      // Crear source node
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      
      // Configurar eventos
      source.onended = () => {
        console.log('✅ [VOICE-ASSISTANT] Reproducción finalizada')
        setIsSpeaking(false)
        setCurrentAudio(null)
        resolve()
      }
      
      // Iniciar reproducción
      source.start(0)
      setCurrentAudio(source)
      
      console.log('✅ [VOICE-ASSISTANT] Reproducción iniciada exitosamente')
      
    } catch (error) {
      console.error('❌ [VOICE-ASSISTANT] Error en Web Audio API:', error)
      setIsSpeaking(false)
      reject(error)
    }
  })
}

/**
 * Fallback: Reproducir audio usando HTML Audio Element
 */
export const playAudioWithHTMLElement = async (audioBase64, setIsSpeaking, setCurrentAudio) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔊 [VOICE-ASSISTANT] Reproduciendo con HTML Audio Element...')
      setIsSpeaking(true)
      
      // Convertir base64 a Blob
      const audioData = atob(audioBase64)
      const arrayBuffer = new ArrayBuffer(audioData.length)
      const view = new Uint8Array(arrayBuffer)
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i)
      }
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(blob)
      
      // Crear elemento de audio con configuración para Safari iOS
      const audio = new Audio()
      
      // Importante para Safari iOS
      audio.preload = 'auto'
      audio.playsInline = true // Crucial para iOS
      
      audio.onended = () => {
        console.log('✅ [VOICE-ASSISTANT] Reproducción finalizada (HTML Audio)')
        setIsSpeaking(false)
        setCurrentAudio(null)
        URL.revokeObjectURL(audioUrl)
        resolve()
      }
      
      audio.onerror = (event) => {
        console.error('❌ [VOICE-ASSISTANT] Error al reproducir:', audio.error)
        setIsSpeaking(false)
        setCurrentAudio(null)
        URL.revokeObjectURL(audioUrl)
        reject(new Error(`Error: ${audio.error?.message || 'Desconocido'}`))
      }
      
      audio.src = audioUrl
      audio.load() // Pre-cargar para Safari
      setCurrentAudio(audio)
      
      const playPromise = audio.play()
      if (playPromise) {
        playPromise
          .then(() => console.log('✅ [VOICE-ASSISTANT] Reproducción iniciada (HTML Audio)'))
          .catch(playError => {
            console.error('❌ [VOICE-ASSISTANT] Error al reproducir:', playError)
            setIsSpeaking(false)
            setCurrentAudio(null)
            URL.revokeObjectURL(audioUrl)
            reject(playError)
          })
      }
      
    } catch (error) {
      console.error('❌ [VOICE-ASSISTANT] Error en HTML Audio:', error)
      setIsSpeaking(false)
      reject(error)
    }
  })
}

/**
 * Función principal para reproducir audio (intenta Web Audio API primero, luego HTML Audio)
 */
export const playVoiceResponse = async (audioBase64, audioContext, setIsSpeaking, setCurrentAudio) => {
  try {
    // Intentar con Web Audio API primero (mejor para Safari/iOS)
    if (audioContext) {
      try {
        await playAudioWithWebAudioAPI(audioBase64, audioContext, setIsSpeaking, setCurrentAudio)
        return
      } catch (webAudioError) {
        console.warn('⚠️ [VOICE-ASSISTANT] Web Audio API falló, usando fallback:', webAudioError)
      }
    }
    
    // Fallback: HTML Audio Element
    await playAudioWithHTMLElement(audioBase64, setIsSpeaking, setCurrentAudio)
    
  } catch (error) {
    console.error('❌ [VOICE-ASSISTANT] Error al reproducir audio:', error)
    throw error
  }
}

