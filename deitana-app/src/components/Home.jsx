"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown, Search, Trash2, UserSearch, AudioLines, ArrowUp, Mic, Square, CirclePlus, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useAuth } from "../context/AuthContext"
import { auth } from "../components/Authenticator/firebase"
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { useSearchParams, useNavigate } from "react-router-dom"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkEmoji from "remark-emoji"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import rehypeRaw from "rehype-raw"
import "katex/dist/katex.min.css"
import "highlight.js/styles/github.css"
import "../styles/thinking-styles.css"
import { AgentTrace } from "./AgentTrace"

const API_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://semilleros-deitana-project-v1-production.up.railway.app"

const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [message, setMessage] = useState("")
  const [chatMessages, setChatMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const mainContentRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  // Agregar después de los otros estados
  const [activeSection, setActiveSection] = useState("historial")
  const [historialExpanded, setHistorialExpanded] = useState(true)

  // Eliminar la línea donde se declara historialExpanded:
  // const [historialExpanded, setHistorialExpanded] = useState(false)

  // Agregar un nuevo estado para controlar el menú del usuario:
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [modalView, setModalView] = useState("main") // 'main', 'admin', 'appearance', etc.

  // Estado para el modal de búsqueda
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [activeHeaderOption, setActiveHeaderOption] = useState("chat")
  
  // Estados para modo de voz con AudioLines
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceRecognition, setVoiceRecognition] = useState(null)
  const [speechSynthesis, setSpeechSynthesis] = useState(null)
  
  // Estados para asistente de voz multimodal con OpenAI
  const [isVoiceAssistantActive, setIsVoiceAssistantActive] = useState(false)
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [voiceMediaRecorder, setVoiceMediaRecorder] = useState(null)
  // eslint-disable-next-line no-unused-vars
  const [voiceAudioChunks, setVoiceAudioChunks] = useState([])
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [currentAudio, setCurrentAudio] = useState(null)

  // Estados para el drag del bottom sheet en móvil
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [startY, setStartY] = useState(0)

  // Estados para el drag del search bottom sheet
  const [isSearchDragging, setIsSearchDragging] = useState(false)
  const [searchDragY, setSearchDragY] = useState(0)
  const [searchStartY, setSearchStartY] = useState(0)

  // Estados para grabación de audio
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isTranscriptionPaused, setIsTranscriptionPaused] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  // eslint-disable-next-line no-unused-vars
  const [audioChunks, setAudioChunks] = useState([])



  // Obtener la función de logout del contexto de autenticación
  const { logout, user } = useAuth()

  // Estados para el perfil de usuario
  const [profileName, setProfileName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [profileSuccess, setProfileSuccess] = useState("")
  const fileInputRef = useRef(null)

  // Función para obtener las iniciales del usuario
  const getUserInitials = () => {
    if (!user?.displayName) return "U"
    
    const names = user.displayName.split(" ")
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase()
    }
    return names[0][0].toUpperCase()
  }

  // Función para obtener la imagen del avatar o las iniciales
  const getUserAvatar = () => {
    if (user?.photoURL) {
      return <img src={user.photoURL} alt="Avatar" className="ds-avatar-image" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
    }
    return <span>{getUserInitials()}</span>
  }

  // Función para obtener solo el primer nombre del usuario
  const getUserFirstName = () => {
    if (!user?.displayName) return "Usuario"
    
    const names = user.displayName.split(" ")
    return names[0]
  }

  // Datos de ejemplo para el historial de chats
  const [chatHistory, setChatHistory] = useState([])

  // Sincronizar datos del usuario con estados locales
  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || "")
      // La imagen se manejará desde user.photoURL
    }
  }, [user])

  // Agregar estado para forzar la actualización de las fechas
  const [timeUpdate, setTimeUpdate] = useState(0)

  // Estados para paginación del historial
  const [historialItemsToShow, setHistorialItemsToShow] = useState(10) // Mostrar 10 inicialmente
  const HISTORIAL_INCREMENT = 10 // Cargar 10 más cada vez

  // Cargar el historial de chats al montar el componente
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) return

        const response = await fetch(`${API_URL}/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error(`Error al cargar el historial: ${response.status}`)
        }

        const data = await response.json()
        if (data.success) {
          setChatHistory(data.data)
        } else {
          throw new Error(data.error || "Error al cargar el historial de chats")
        }
      } catch (error) {
        console.error("Error al cargar el historial de chats:", error)
      }
    }

    loadChatHistory()
  }, [])

  // Detectar si estamos en móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
      if (window.innerWidth > 768) {
        setMobileSidebarOpen(false)
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileSidebarOpen(!mobileSidebarOpen)
    } else {
      setSidebarOpen(!sidebarOpen)
    }
  }

  // Funciones para manejo del perfil
  const handleImageSelect = () => {
    fileInputRef.current?.click()
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setProfileError("Por favor selecciona un archivo de imagen válido")
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfileError("La imagen debe ser menor a 5MB")
      return
    }

    try {
      setIsUpdatingProfile(true)
      setProfileError("")

      // Inicializar Firebase Storage
      const storage = getStorage()
      const imageRef = ref(storage, `profile-images/${user.uid}/${Date.now()}-${file.name}`)

      // Subir imagen
      const snapshot = await uploadBytes(imageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)

      // Actualizar perfil del usuario
      await updateProfile(user, {
        photoURL: downloadURL
      })

      setProfileSuccess("Imagen actualizada exitosamente")
      setTimeout(() => setProfileSuccess(""), 3000)

    } catch (error) {
      console.error("Error al subir imagen:", error)
      setProfileError("Error al subir la imagen. Intenta de nuevo.")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdateName = async () => {
    if (!profileName.trim()) {
      setProfileError("El nombre no puede estar vacío")
      return
    }

    try {
      setIsUpdatingProfile(true)
      setProfileError("")

      await updateProfile(user, {
        displayName: profileName.trim()
      })

      setProfileSuccess("Nombre actualizado exitosamente")
      setTimeout(() => setProfileSuccess(""), 3000)

    } catch (error) {
      console.error("Error al actualizar nombre:", error)
      setProfileError("Error al actualizar el nombre. Intenta de nuevo.")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      setProfileError("Debes completar ambos campos de contraseña")
      return
    }

    if (newPassword.length < 6) {
      setProfileError("La nueva contraseña debe tener al menos 6 caracteres")
      return
    }

    try {
      setIsUpdatingProfile(true)
      setProfileError("")

      // Reautenticar usuario
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)

      // Actualizar contraseña
      await updatePassword(user, newPassword)

      setNewPassword("")
      setCurrentPassword("")
      setProfileSuccess("Contraseña actualizada exitosamente")
      setTimeout(() => setProfileSuccess(""), 3000)

    } catch (error) {
      console.error("Error al actualizar contraseña:", error)
      if (error.code === 'auth/wrong-password') {
        setProfileError("La contraseña actual es incorrecta")
      } else {
        setProfileError("Error al actualizar la contraseña. Intenta de nuevo.")
      }
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleSaveChanges = async () => {
    setProfileError("")
    setProfileSuccess("")

    // Actualizar nombre si cambió
    if (profileName.trim() !== user?.displayName) {
      await handleUpdateName()
    }

    // Actualizar contraseña si se proporcionó
    if (newPassword && currentPassword) {
      await handleUpdatePassword()
    }

    if (profileName.trim() === user?.displayName && !newPassword) {
      setProfileError("No hay cambios para guardar")
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      console.log("Sesión cerrada exitosamente")
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }
  }

  // Cargar la conversación desde la URL al montar el componente
  useEffect(() => {
    const conversationId = searchParams.get("chat")
    if (conversationId && !conversationId.startsWith("temp_")) {
      // Validar que el chat pertenece al usuario antes de cargarlo
      const validateAndLoadChat = async () => {
        try {
          const token = await auth.currentUser?.getIdToken()
          if (!token) return

          // Intentar cargar los mensajes del chat (esto ya valida la pertenencia en el backend)
          const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (response.ok) {
            // Si la respuesta es exitosa, el chat pertenece al usuario
            setCurrentConversationId(conversationId)
          } else if (response.status === 404 || response.status === 403) {
            // Si el chat no existe o no pertenece al usuario, limpiar la URL
            console.warn("Chat no encontrado o no pertenece al usuario:", conversationId)
            setSearchParams({}) // Limpiar parámetros de URL
            setCurrentConversationId(null)
            setChatMessages([])
          } else {
            console.error("Error al validar el chat:", response.status)
          }
        } catch (error) {
          console.error("Error al validar la conversación:", error)
          // En caso de error, limpiar la URL para evitar estados inconsistentes
          setSearchParams({})
          setCurrentConversationId(null)
          setChatMessages([])
        }
      }

      validateAndLoadChat()
    }
  }, [searchParams, setSearchParams])

  const handleConversationClick = (conversationId) => {
    console.log("Conversación seleccionada:", conversationId)
    setCurrentConversationId(conversationId)
    // Actualizar la URL sin recargar la página
    setSearchParams({ chat: conversationId })
    if (isMobile) {
      setMobileSidebarOpen(false)
    }
  }

  const handleNewChat = async () => {
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return

      // Crear nueva conversación
      const response = await fetch(`${API_URL}/chat/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: "NUEVA_CONEXION" }),
      })

      if (!response.ok) {
        throw new Error("Error al crear nueva conversación")
      }

      const data = await response.json()
      if (data.success) {
        setCurrentConversationId(data.data.conversationId)
        setChatMessages([])
        // Limpiar la URL
        setSearchParams({})

        // Recargar el historial de chats
        const historyResponse = await fetch(`${API_URL}/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!historyResponse.ok) {
          throw new Error("Error al cargar el historial")
        }

        const historyData = await historyResponse.json()
        if (historyData.success) {
          setChatHistory(historyData.data)
        }

        // Actualizar conversationId si viene del servidor
        if (data.conversationId && (!currentConversationId || currentConversationId.startsWith('temp_'))) {
          console.log("🔄 [FRONTEND] Actualizando conversationId:", data.conversationId)
          setCurrentConversationId(data.conversationId)
          // Actualizar la URL para reflejar la nueva conversación
          setSearchParams({ chat: data.conversationId })
          
          // Recargar el historial de conversaciones para mostrar la nueva
          const recargarHistorial = async () => {
            try {
              const token = await auth.currentUser?.getIdToken()
              if (!token) return

              const historyResponse = await fetch(`${API_URL}/conversations`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              })

              if (historyResponse.ok) {
                const historyData = await historyResponse.json()
                if (historyData.success) {
                  setChatHistory(historyData.data)
                  console.log("✅ [FRONTEND] Historial de conversaciones actualizado")
                }
              }
            } catch (error) {
              console.error("❌ [FRONTEND] Error recargando historial:", error)
            }
          }
          recargarHistorial()
        }
      }
    } catch (error) {
      console.error("Error al crear nuevo chat:", error)
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: "Hubo un error al crear el chat. Por favor, intenta de nuevo.",
          sender: "bot",
          isError: true,
        },
      ])
    }
  }

  const loadConversationMessages = async (conversationId) => {
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return

      const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Error al cargar los mensajes: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        // Convertir los mensajes al formato que espera el componente
        const formattedMessages = data.data.map((msg) => ({
          id: Date.now() + Math.random(),
          text: msg.content,
          sender: msg.role === "user" ? "user" : "bot",
        }))
        setChatMessages(formattedMessages)
      } else {
        throw new Error(data.error || "Error al cargar los mensajes")
      }
    } catch (error) {
      console.error("Error al cargar los mensajes:", error)
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: "Hubo un error al cargar los mensajes. Por favor, intenta de nuevo.",
          sender: "bot",
          isError: true,
        },
      ])
    }
  }

  // Modificar el useEffect para cargar los mensajes cuando cambia la conversación
  useEffect(() => {
    if (currentConversationId && !currentConversationId.startsWith("temp_")) {
      loadConversationMessages(currentConversationId)
    }
  }, [currentConversationId])

  // Limpiar modo de voz al desmontar
  useEffect(() => {
    return () => {
      if (voiceRecognition) {
        voiceRecognition.stop()
      }
      if (speechSynthesis) {
        speechSynthesis.cancel()
      }
    }
  }, [voiceRecognition, speechSynthesis])

  // Funciones para modo de voz con AudioLines
  const initializeVoiceMode = async () => {
    console.log('🎤 Inicializando modo de voz con AudioLines...')
    
    // Si no hay conversación activa, crear una nueva
    if (!currentConversationId) {
      console.log('🎤 Creando nueva conversación para modo de voz...')
      try {
        await handleNewChat()
      } catch (error) {
        console.error('❌ Error al crear nueva conversación:', error)
      }
    }
    
    // Inicializar Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'es-ES'
      
      recognition.onstart = () => {
        console.log('🎤 Reconocimiento de voz iniciado')
        setIsListening(true)
      }
      
      recognition.onresult = (event) => {
        let finalTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          }
        }
        
        if (finalTranscript) {
          console.log('🎤 Transcripción final:', finalTranscript)
          handleVoiceInput(finalTranscript)
        }
      }
      
      recognition.onerror = (event) => {
        console.error('❌ Error en reconocimiento de voz:', event.error)
        setIsListening(false)
      }
      
      recognition.onend = () => {
        console.log('🛑 Reconocimiento de voz terminado')
        setIsListening(false)
        
        // Reiniciar automáticamente si estamos en modo de voz
        if (isVoiceMode) {
          setTimeout(() => {
            if (isVoiceMode && !isSpeaking) {
              console.log('🔄 Reiniciando reconocimiento de voz...')
              recognition.start()
            }
          }, 1000)
        }
      }
      
      setVoiceRecognition(recognition)
      recognition.start()
    } else {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.')
    }
    
    // Inicializar Speech Synthesis
    if ('speechSynthesis' in window) {
      setSpeechSynthesis(window.speechSynthesis)
    }
  }
  
  const stopVoiceMode = () => {
    console.log('🛑 Deteniendo modo de voz...')
    
    if (voiceRecognition) {
      voiceRecognition.stop()
      setVoiceRecognition(null)
    }
    
    if (speechSynthesis) {
      speechSynthesis.cancel()
      setSpeechSynthesis(null)
    }
    
    setIsListening(false)
    setIsSpeaking(false)
  }
  
  const handleVoiceInput = async (transcript) => {
    console.log('🎤 Procesando entrada de voz:', transcript)
    
    // Agregar mensaje del usuario
    const userMessage = {
      id: Date.now(),
      text: transcript,
      sender: "user",
      timestamp: new Date().toISOString(),
      isVoice: true
    }
    
    setChatMessages((prev) => [...prev, userMessage])
    setIsTyping(true)
    
    try {
      // Enviar a la API
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        throw new Error("No se pudo obtener el token de autenticación")
      }
      
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: transcript,
          conversationId: currentConversationId
        })
      })
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      
      // Crear mensaje del bot
      const botMessage = {
        id: Date.now() + 1,
        text: "",
        sender: "bot",
        timestamp: new Date().toISOString(),
        isStreaming: true,
        isVoice: true
      }
      
      setChatMessages((prev) => [...prev, botMessage])
      
      // Procesar streaming
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ""
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'content') {
                fullResponse += data.content
                // eslint-disable-next-line no-loop-func
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessage.id
                      ? { ...msg, text: fullResponse }
                      : msg
                  )
                )
              } else if (data.type === 'done') {
                // Finalizar streaming
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessage.id
                      ? { ...msg, isStreaming: false }
                      : msg
                  )
                )
                
                // Reproducir respuesta con voz Alloy
                speakResponse(fullResponse)
              }
            } catch (e) {
              console.error('Error parsing chunk:', e)
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error en modo de voz:', error)
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Error al procesar tu consulta de voz. Intenta de nuevo.",
          sender: "bot",
          timestamp: new Date().toISOString(),
          isVoice: true
        }
      ])
    } finally {
      setIsTyping(false)
    }
  }
  
  const speakResponse = (text) => {
    if (!speechSynthesis) return
    
    console.log('🔊 Reproduciendo respuesta con Alloy:', text)
    setIsSpeaking(true)
    
    // Cancelar cualquier síntesis anterior
    speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-ES'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 0.8
    
    // Buscar voz Alloy si está disponible
    const voices = speechSynthesis.getVoices()
    const alloyVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('alloy') || 
      voice.name.toLowerCase().includes('google') ||
      voice.name.toLowerCase().includes('español')
    )
    
    if (alloyVoice) {
      utterance.voice = alloyVoice
      console.log('🎤 Usando voz:', alloyVoice.name)
    }
    
    utterance.onend = () => {
      console.log('🔊 Reproducción terminada')
      setIsSpeaking(false)
    }
    
    utterance.onerror = (event) => {
      console.error('❌ Error en síntesis de voz:', event.error)
      setIsSpeaking(false)
    }
    
    speechSynthesis.speak(utterance)
  }


  // Funciones para grabación de audio con OpenAI Whisper
  const startRecording = async () => {
    try {
      console.log('🎤 Iniciando grabación de audio...');
      
      // Solicitar permisos de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      // Crear MediaRecorder
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
        console.log('🛑 Grabación detenida, procesando audio...');
        
        // Crear blob del audio
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Detener el stream
        stream.getTracks().forEach(track => track.stop());
        
        // Transcribir audio
        await transcribeAudio(audioBlob);
        
        // Limpiar chunks
        setAudioChunks([]);
      };
      
      // Iniciar grabación
      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
      
      console.log('✅ Grabación iniciada');
      
    } catch (error) {
      console.error('❌ Error al iniciar grabación:', error);
      alert('Error al acceder al micrófono. Verifica los permisos.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      console.log('🛑 Deteniendo grabación...');
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      setIsTranscribing(true);
      console.log('🔄 Enviando audio a Whisper API...');
      console.log('🔄 [FRONTEND] Tamaño del audio:', audioBlob.size, 'bytes');
      console.log('🔄 [FRONTEND] Tipo del audio:', audioBlob.type);
      console.log('🔄 [FRONTEND] Usuario actual:', user?.uid);
      console.log('🔄 [FRONTEND] Token disponible:', !!user?.accessToken);
      
      // Crear FormData
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'es'); // Español
      formData.append('response_format', 'text');
      
      // Enviar a OpenAI Whisper API
      const response = await fetch(`${API_URL}/api/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}` // Usar token del usuario
        },
        body: formData
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: await response.text() };
        }
        console.error('❌ [FRONTEND] Error en transcripción:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Error en transcripción: ${response.status} - ${errorData.error || 'Error desconocido'}`);
      }
      
      const responseData = await response.json();
      const transcribedText = responseData.text;
      console.log('✅ Audio transcrito:', transcribedText);
      console.log('📊 Detalles de transcripción:', {
        duración: responseData.duration + 'ms',
        tamañoArchivo: responseData.fileSize + ' bytes'
      });
      
      // Establecer el texto transcrito en el input
      const cleanText = transcribedText.trim();
      setMessage(prev => {
        // Si ya hay texto, agregarlo al final
        if (prev.trim()) {
          return prev + ' ' + cleanText;
        } else {
          return cleanText;
        }
      });
      
      // Mostrar mensaje de confirmación
      console.log('🎤 Transcripción completada. El texto está listo para enviar.');
      console.log('📝 Texto transcrito:', cleanText);
      
      // Enfocar el input para que el usuario pueda editar si quiere
      setTimeout(() => {
        const input = document.querySelector('.ds-chat-input');
        if (input) {
          input.focus();
          // Colocar el cursor al final del texto completo
          const fullText = input.value;
          input.setSelectionRange(fullText.length, fullText.length);
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ Error en transcripción:', error);
      alert('Error al transcribir el audio. Intenta de nuevo.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Si ya hay texto transcrito, preguntar si quiere agregar o reemplazar
      if (message.trim()) {
        const shouldAppend = window.confirm(
          'Ya tienes texto transcrito. ¿Quieres agregar la nueva grabación al texto existente?\n\n' +
          '• Aceptar: Agregar al texto existente\n' +
          '• Cancelar: Reemplazar el texto existente'
        );
        
        if (shouldAppend) {
          // Agregar espacio antes de la nueva grabación
          setMessage(prev => prev + ' ');
        } else {
          // Limpiar el texto existente
          setMessage('');
        }
      }
      startRecording();
    }
  };

  const handleSquareClick = () => {
    console.log('⏹️ Deteniendo grabación...');
    if (isRecording) {
      stopRecording();
    } else if (isTranscribing) {
      // Si está transcribiendo, cancelar la transcripción
      setIsTranscribing(false);
      setIsTranscriptionPaused(true);
    }
  };

  const handleArrowUpClick = () => {
    if (message.trim() || selectedImage) {
      console.log('⬆️ Enviando mensaje transcrito...');
      // Enviar el mensaje actual
      handleSubmit({ preventDefault: () => {} });
    }
  };

  // Función para manejar la selección de imágenes para el chat
  const handleImageSelectForChat = () => {
    const fileInput = document.getElementById('chat-image-input')
    fileInput?.click()
  }

  const handleImageUploadForChat = (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert("Por favor selecciona un archivo de imagen válido")
      return
    }

    // Validar tamaño (máximo 10MB para chat)
    if (file.size > 10 * 1024 * 1024) {
      alert("La imagen debe ser menor a 10MB")
      return
    }

    setSelectedImage(file)
    console.log("Imagen seleccionada para el chat:", file.name)
  }

  const removeSelectedImage = () => {
    setSelectedImage(null)
    // Limpiar el input file
    const fileInput = document.getElementById('chat-image-input')
    if (fileInput) {
      fileInput.value = ''
    }
  }

  // ========================================
  // FUNCIONES PARA ASISTENTE DE VOZ MULTIMODAL CON OPENAI
  // ========================================

  /**
   * Activar/Desactivar el modo de asistente de voz
   */
  const toggleVoiceAssistant = async () => {
    if (isVoiceAssistantActive) {
      // Desactivar asistente de voz
      await deactivateVoiceAssistant()
    } else {
      // Activar asistente de voz
      await activateVoiceAssistant()
    }
  }

  /**
   * Activar el asistente de voz
   */
  const activateVoiceAssistant = async () => {
    try {
      console.log('🎤 [VOICE-ASSISTANT] Activando asistente de voz...')
      
      // Detener cualquier audio que esté reproduciéndose
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }
      
      setIsVoiceAssistantActive(true)
      
      // Iniciar grabación automáticamente
      await startVoiceRecording()
      
    } catch (error) {
      console.error('❌ [VOICE-ASSISTANT] Error al activar:', error)
      alert('Error al activar el asistente de voz. Verifica los permisos del micrófono.')
      setIsVoiceAssistantActive(false)
    }
  }

  /**
   * Desactivar el asistente de voz
   */
  const deactivateVoiceAssistant = async () => {
    console.log('🎤 [VOICE-ASSISTANT] Desactivando asistente de voz...')
    
    // Detener grabación si está activa
    if (isVoiceRecording) {
      stopVoiceRecording(false) // false = no procesar
    }
    
    // Detener audio si está reproduciéndose
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
    }
    
    setIsVoiceAssistantActive(false)
    setIsVoiceRecording(false)
    setIsProcessingVoice(false)
    setIsSpeaking(false)
  }

  /**
   * Iniciar grabación de voz
   */
  const startVoiceRecording = async () => {
    try {
      console.log('🎤 [VOICE-ASSISTANT] Iniciando grabación...')
      
      // Solicitar permisos de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      })
      
      // Crear MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      const chunks = []
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      recorder.onstop = async () => {
        console.log('🛑 [VOICE-ASSISTANT] Grabación detenida')
        
        // Crear blob del audio
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        console.log('📦 [VOICE-ASSISTANT] Audio blob creado:', audioBlob.size, 'bytes')
        
        // Detener el stream
        stream.getTracks().forEach(track => track.stop())
        
        // Solo procesar si hay audio suficiente (más de 1KB)
        if (audioBlob.size > 1000) {
          await processVoiceInput(audioBlob)
        } else {
          console.log('⚠️ [VOICE-ASSISTANT] Audio muy corto, ignorando...')
          // Si el modo sigue activo, volver a grabar
          if (isVoiceAssistantActive) {
            setTimeout(() => {
              if (isVoiceAssistantActive) {
                startVoiceRecording()
              }
            }, 500)
          }
        }
      }
      
      recorder.start()
      setVoiceMediaRecorder(recorder)
      setVoiceAudioChunks(chunks)
      setIsVoiceRecording(true)
      
      // Auto-detener después de 10 segundos para enviar el mensaje
      setTimeout(() => {
        if (recorder.state === 'recording') {
          console.log('⏱️ [VOICE-ASSISTANT] Tiempo límite alcanzado, deteniendo grabación...')
          recorder.stop()
        }
      }, 10000) // 10 segundos
      
      console.log('✅ [VOICE-ASSISTANT] Grabación iniciada. Habla ahora... (máx 10 seg)')
      
    } catch (error) {
      console.error('❌ [VOICE-ASSISTANT] Error al iniciar grabación:', error)
      alert('No se pudo acceder al micrófono. Verifica los permisos.')
      setIsVoiceAssistantActive(false)
    }
  }

  /**
   * Detener grabación de voz
   */
  const stopVoiceRecording = (shouldProcess = true) => {
    console.log('🛑 [VOICE-ASSISTANT] Deteniendo grabación...', shouldProcess ? '(procesando)' : '(cancelando)')
    
    if (voiceMediaRecorder && voiceMediaRecorder.state !== 'inactive') {
      if (!shouldProcess) {
        // Si no queremos procesar, limpiar el evento onstop
        voiceMediaRecorder.onstop = () => {
          console.log('🛑 [VOICE-ASSISTANT] Grabación cancelada')
        }
      }
      voiceMediaRecorder.stop()
    }
    
    setIsVoiceRecording(false)
    setVoiceMediaRecorder(null)
  }

  /**
   * Procesar entrada de voz
   */
  const processVoiceInput = async (audioBlob) => {
    try {
      setIsProcessingVoice(true)
      console.log('🔄 [VOICE-ASSISTANT] Procesando entrada de voz...')
      
      // Crear FormData
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice-input.webm')
      formData.append('conversationId', currentConversationId || '')
      
      // Agregar imagen si existe
      if (selectedImage) {
        const reader = new FileReader()
        const imageBase64 = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target.result)
          reader.onerror = reject
          reader.readAsDataURL(selectedImage)
        })
        formData.append('image', imageBase64)
      }
      
      // Enviar al backend
      console.log('📤 [VOICE-ASSISTANT] Enviando al backend...')
      const response = await fetch(`${API_URL}/api/voice-assistant/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        },
        body: formData
      })
      
      console.log('📡 [VOICE-ASSISTANT] Respuesta HTTP recibida:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { error: 'Error de conexión con el servidor' }
        }
        console.error('❌ [VOICE-ASSISTANT] Error del servidor:', errorData)
        throw new Error(errorData.error || 'Error al procesar voz')
      }
      
      const data = await response.json()
      console.log('✅ [VOICE-ASSISTANT] Respuesta recibida:', {
        conversationId: data.conversationId,
        transcription: data.transcription,
        responseLength: data.response?.length || 0,
        hasAudio: !!data.audio,
        audioLength: data.audio?.length || 0
      })
      
      // Actualizar conversación
      if (data.conversationId) {
        setCurrentConversationId(data.conversationId)
      }
      
      // Agregar mensaje del usuario
      const userMessage = {
        role: 'user',
        content: data.transcription,
        timestamp: new Date().toISOString(),
        hasImage: !!selectedImage,
        isVoice: true
      }
      
      setChatMessages(prev => [...prev, userMessage])
      
      // Limpiar imagen seleccionada
      setSelectedImage(null)
      
      // Agregar respuesta del asistente
      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        isVoice: true
      }
      
      setChatMessages(prev => [...prev, assistantMessage])
      
      // Reproducir audio de respuesta
      await playVoiceResponse(data.audio)
      
      // Después de reproducir, volver a grabar automáticamente si el modo sigue activo
      if (isVoiceAssistantActive) {
        setTimeout(() => {
          if (isVoiceAssistantActive) {
            startVoiceRecording()
          }
        }, 500)
      }
      
    } catch (error) {
      console.error('❌ [VOICE-ASSISTANT] Error al procesar voz:', error)
      alert(`Error: ${error.message}`)
      
      // Reintentar grabación si el modo sigue activo
      if (isVoiceAssistantActive) {
        setTimeout(() => {
          if (isVoiceAssistantActive) {
            startVoiceRecording()
          }
        }, 1000)
      }
    } finally {
      setIsProcessingVoice(false)
    }
  }

  /**
   * Reproducir respuesta de voz
   */
  const playVoiceResponse = async (audioBase64) => {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔊 [VOICE-ASSISTANT] Reproduciendo respuesta...')
        setIsSpeaking(true)
        
        // Convertir base64 a blob
        const audioData = atob(audioBase64)
        const arrayBuffer = new ArrayBuffer(audioData.length)
        const view = new Uint8Array(arrayBuffer)
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i)
        }
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
        const audioUrl = URL.createObjectURL(blob)
        
        // Crear elemento de audio
        const audio = new Audio(audioUrl)
        
        audio.onended = () => {
          console.log('✅ [VOICE-ASSISTANT] Reproducción finalizada')
          setIsSpeaking(false)
          setCurrentAudio(null)
          URL.revokeObjectURL(audioUrl)
          resolve()
        }
        
        audio.onerror = (error) => {
          console.error('❌ [VOICE-ASSISTANT] Error al reproducir:', error)
          setIsSpeaking(false)
          setCurrentAudio(null)
          URL.revokeObjectURL(audioUrl)
          reject(error)
        }
        
        setCurrentAudio(audio)
        audio.play()
        
      } catch (error) {
        console.error('❌ [VOICE-ASSISTANT] Error en reproducción:', error)
        setIsSpeaking(false)
        reject(error)
      }
    })
  }

  // Función para convertir archivo a base64
  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }

  // Modificar la función handleSubmit para usar la conversación actual
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim() && !selectedImage) return

    console.log("🚀 [FRONTEND] === INICIO ENVÍO DE MENSAJE CON STREAMING ===")
    console.log("🚀 [FRONTEND] Mensaje a enviar:", message)
    console.log("🚀 [FRONTEND] Conversation ID actual:", currentConversationId)

    const userMessage = {
      id: Date.now(),
      text: message || (selectedImage ? `📷 Imagen: ${selectedImage.name}` : ""),
      sender: "user",
      image: selectedImage ? {
        file: selectedImage,
        name: selectedImage.name,
        size: selectedImage.size,
        type: selectedImage.type
      } : null,
      // Guardar referencia a la imagen para mostrar en el chat
      hasImage: !!selectedImage
    }

    setChatMessages((prev) => [...prev, userMessage])
    setMessage("")
    setIsTyping(true)
    
    // Si hay imagen, mostrar mensaje especial
    if (selectedImage) {
      console.log("🖼️ [FRONTEND] Procesando imagen:", selectedImage.name);
    }

    // Crear mensaje del bot con estado de streaming
    const botMessage = {
      id: Date.now() + 1,
      text: selectedImage ? "🖼️ Analizando imagen y generando consulta..." : "",
      sender: "bot",
      isStreaming: true,
    }

    setChatMessages((prev) => {
      console.log("🤖 [FRONTEND] Creando nuevo mensaje del bot:", botMessage)
      return [...prev, botMessage]
    })

    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        throw new Error("No hay usuario autenticado")
      }

      console.log("🔑 [FRONTEND] Token obtenido, iniciando streaming...")
      console.log("🖼️ [FRONTEND] Imagen seleccionada:", selectedImage ? selectedImage.name : "Ninguna")

      // =====================================
      // NUEVA IMPLEMENTACIÓN CON STREAMING NATURAL
      // =====================================
      
      const response = await fetch(`${API_URL}/api/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        body: JSON.stringify({ 
          message,
          conversationId: currentConversationId,
          image: selectedImage ? await (async () => {
            console.log("🔄 [FRONTEND] Convirtiendo imagen a base64...");
            const base64 = await convertFileToBase64(selectedImage);
            console.log("✅ [FRONTEND] Imagen convertida, tamaño base64:", base64.length);
            return base64;
          })() : null
        }),
        })

        if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`)
      }

      console.log("✅ [FRONTEND] Conexión de streaming establecida")

      // Variables para streaming natural
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ""
      let buffer = ""
      let streamingInterval = null

      // Función para mostrar el buffer acumulado de forma suave
      const flushBuffer = () => {
        if (buffer.trim()) {
          fullResponse += buffer
          
          // Capturar variables para evitar problemas de closure
          const messageId = botMessage.id
          const currentResponse = fullResponse
          
          setChatMessages((prev) =>
            prev.map((msg) =>
                msg.id === messageId
              ? {
                  ...msg,
                    text: currentResponse,
                    isStreaming: true,
                }
              : msg,
            ),
          )

          console.log("📝 [FRONTEND] Mostrando buffer:", buffer.trim())
          buffer = ""
        }
      }

      // Intervalo para mostrar contenido de forma muy fluida (cada 30ms)
      streamingInterval = setInterval(() => {
        flushBuffer() // Mostrar cualquier contenido pendiente cada 30ms
      }, 30)

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            console.log("🏁 [FRONTEND] Stream completado")
            break
          }

          // Decodificar el chunk
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim())

                      for (const line of lines) {
              try {
                const data = JSON.parse(line)
                
                if (data.type === 'chunk' && data.content) {
                // Filtrar contenido válido y agregarlo al buffer
                const content = data.content
                
                // Solo agregar contenido que no sea vacío o caracteres extraños
                if (content && content.trim()) {
                  buffer += content
                } else if (content === ' ' || content === '\n') {
                  // Preservar espacios y saltos de línea
                  buffer += content
                }
                
              } else if (data.type === 'thinking') {
                console.log("🤔 [FRONTEND] Mensaje de pensando recibido:", data.message)
                
                // Mostrar mensaje de "pensando" al usuario con estilos especiales
                const messageId = botMessage.id
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === messageId
                      ? {
                          ...msg,
                          text: data.message,
                          isStreaming: true,
                          isThinking: true, // Marcar como mensaje de thinking
                          trace: data.trace || [], // Agregar trace data
                        }
                      : msg,
                  ),
                )
                
              } else if (data.type === 'thinking_complete') {
                console.log("✅ [FRONTEND] Thinking completado:", data.message)
                
                // Actualizar el mensaje con el trace completo
                const messageId = botMessage.id
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === messageId
                      ? {
                          ...msg,
                          text: data.message,
                          isStreaming: true,
                          isThinking: true,
                          trace: data.trace || [],
                        }
                      : msg,
                  ),
                )
                
              } else if (data.type === 'sql_executing') {
                console.log("🔍 [FRONTEND] SQL ejecutándose:", data.message)
                
                // Actualizar el mensaje con el trace de SQL
                const messageId = botMessage.id
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === messageId
                      ? {
                          ...msg,
                          text: data.message,
                          isStreaming: true,
                          isThinking: true,
                          trace: data.trace || [],
                        }
                      : msg,
                  ),
                )
                
              } else if (data.type === 'end') {
                console.log("✅ [FRONTEND] Stream finalizado exitosamente")
                
                // Actualizar conversationId si viene del servidor
                if (data.conversationId && (!currentConversationId || currentConversationId.startsWith('temp_'))) {
                  console.log("🔄 [FRONTEND] Actualizando conversationId:", data.conversationId)
                  setCurrentConversationId(data.conversationId)
                  // Actualizar la URL para reflejar la nueva conversación
                  setSearchParams({ chat: data.conversationId })
                }
                
                // Limpiar el intervalo y mostrar cualquier contenido restante
                if (streamingInterval) {
                  clearInterval(streamingInterval)
                  flushBuffer() // Mostrar lo que quede en el buffer
                }
                
                // Capturar variables en el scope para evitar problemas de closure
                const messageId = botMessage.id
                const finalResponse = data.fullResponse || fullResponse
                
                // Finalizar el streaming
        setChatMessages((prev) =>
          prev.map((msg) =>
                    msg.id === messageId
              ? {
                  ...msg,
                          text: finalResponse,
                          isStreaming: false, // Finalizar streaming
                          isThinking: false, // Limpiar el estado de thinking
                          trace: prev.find(m => m.id === messageId)?.trace?.map(step => 
                            step.id === "2" ? { ...step, status: "completed", endTime: new Date().toISOString(), duration: 2 } : step
                          ) || [], // Mantener trace y marcar SQL como completado
                }
              : msg,
          ),
        )
                break
              } else if (data.type === 'error') {
                console.error("❌ [FRONTEND] Error en stream:", data.message)
                throw new Error(data.message || "Error en el streaming")
              }
            } catch (parseError) {
              console.warn("⚠️ [FRONTEND] Error parseando línea:", line, parseError)
              // Continuar con el siguiente chunk
            }
          }
        }
      } finally {
        // Limpiar recursos
        if (streamingInterval) {
          clearInterval(streamingInterval)
        }
        reader.releaseLock()
      }

    } catch (error) {
      console.error("❌ [FRONTEND] Error en streaming:", error)
      
      // Capturar variable para evitar problemas de closure
      const messageId = botMessage.id
      
      // Actualizar el mensaje del bot con el error
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                text: "Hubo un error al conectarse con el servidor. Por favor, intenta de nuevo.",
                isStreaming: false,
                isError: true,
              }
            : msg,
        ),
      )
    } finally {
      setIsTyping(false)
      setSelectedImage(null) // Limpiar la imagen seleccionada después del procesamiento
      console.log("🏁 [FRONTEND] === FIN ENVÍO DE MENSAJE ===")
    }
  }

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatMessages, isTyping])

  useEffect(() => {
    const chatContainer = chatContainerRef.current
    if (!chatContainer) return

    const handleScroll = () => {
      const isScrolledUp = chatContainer.scrollTop < chatContainer.scrollHeight - chatContainer.clientHeight - 20
      setShowScrollButton(isScrolledUp && chatMessages.length > 0)
    }

    chatContainer.addEventListener("scroll", handleScroll)
    setTimeout(() => handleScroll(), 500)

    return () => chatContainer.removeEventListener("scroll", handleScroll)
  }, [chatMessages])

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }

  const getScrollButtonStyle = () => {
    if (!mainContentRef.current) return {}

    const mainContentRect = mainContentRef.current.getBoundingClientRect()
    const centerX = mainContentRect.left + mainContentRect.width / 2

    return {
      left: `${centerX}px`,
      transform: "translateX(-50%)",
    }
  }

  const isChatEmpty = chatMessages.length === 0 && !isTyping

  // Funciones para drag del bottom sheet iOS
  const handleTouchStart = (e) => {
    setIsDragging(true)
    setStartY(e.touches[0].clientY)
  }

  const handleTouchMove = (e) => {
    if (!isDragging) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - startY

    if (deltaY > 0) {
      setDragY(deltaY)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)

    if (dragY > 100) {
      setUserMenuOpen(false)
      // Resetear al menú principal cuando se cierra
      setTimeout(() => setModalView("main"), 300)
    }

    setDragY(0)
  }

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setStartY(e.clientY)
  }

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return

    const currentY = e.clientY
    const deltaY = currentY - startY

    if (deltaY > 0) {
      setDragY(deltaY)
    }
  }, [isDragging, startY])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)

    if (dragY > 100) {
      setUserMenuOpen(false)
      // Resetear al menú principal cuando se cierra
      setTimeout(() => setModalView("main"), 300)
    }

    setDragY(0)
  }, [dragY])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Funciones para drag del search bottom sheet
  const handleSearchTouchStart = (e) => {
    setIsSearchDragging(true)
    setSearchStartY(e.touches[0].clientY)
  }

  const handleSearchTouchMove = (e) => {
    if (!isSearchDragging) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - searchStartY

    if (deltaY > 0) {
      setSearchDragY(deltaY)
    }
  }

  const handleSearchTouchEnd = () => {
    setIsSearchDragging(false)

    if (searchDragY > 100) {
      setSearchModalOpen(false)
      setSearchQuery("")
      setDebouncedSearchQuery("")
    }

    setSearchDragY(0)
  }

  const handleSearchMouseDown = (e) => {
    setIsSearchDragging(true)
    setSearchStartY(e.clientY)
  }

  const handleSearchMouseMove = useCallback((e) => {
    if (!isSearchDragging) return

    const currentY = e.clientY
    const deltaY = currentY - searchStartY

    if (deltaY > 0) {
      setSearchDragY(deltaY)
    }
  }, [isSearchDragging, searchStartY])

  const handleSearchMouseUp = useCallback(() => {
    setIsSearchDragging(false)

    if (searchDragY > 100) {
      setSearchModalOpen(false)
      setSearchQuery("")
      setDebouncedSearchQuery("")
    }

    setSearchDragY(0)
  }, [searchDragY])

  useEffect(() => {
    if (isSearchDragging) {
      document.addEventListener("mousemove", handleSearchMouseMove)
      document.addEventListener("mouseup", handleSearchMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleSearchMouseMove)
        document.removeEventListener("mouseup", handleSearchMouseUp)
      }
    }
  }, [isSearchDragging, handleSearchMouseMove, handleSearchMouseUp])

  // Añadir estilos CSS para el indicador de escritura en línea
  useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = `
    .ds-typing-indicator-inline {
      display: inline-flex;
      align-items: center;
      margin-left: 5px;
    }
    
    .ds-typing-indicator-inline span {
      height: 6px;
      width: 6px;
      background-color: #333;
      border-radius: 50%;
      display: inline-block;
      margin: 0 2px;
      opacity: 0.6;
      animation: ds-typing 1s infinite;
    }
    
    .ds-typing-indicator-inline span:nth-child(1) {
      animation-delay: 0s;
    }
    
    .ds-typing-indicator-inline span:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .ds-typing-indicator-inline span:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes ds-typing {
      0% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(-5px);
      }
      100% {
        transform: translateY(0px);
      }
    }

    .ds-message-content p {
      margin: 0;
      line-height: 1.6;
      color: #333;
      font-size: 15px;
      margin-bottom: 12px;
    }

    .ds-message-content strong {
      font-weight: 600;
      font-size: 15px;
      color: #333;
      display: inline;
      margin-right: 4px;
    }

    .ds-message-content em {
      font-style: italic;
      color: #333;
      font-size: 15px;
    }

    .ds-message-content ul, .ds-message-content ol {
      margin: 8px 0;
      padding-left: 20px;
      color: #333;
      font-size: 15px;
    }

    .ds-message-content li {
      margin: 5px 0;
      color: #333;
      font-size: 15px;
    }

    /* Permitir diferentes estilos de listas según el contexto */
    .ds-message-content ul li {
      list-style-type: disc;
    }

    .ds-message-content ol li {
      list-style-type: decimal;
    }

    /* Estilos para tablas */
    .ds-message-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }

    .ds-message-content th, .ds-message-content td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }

    .ds-message-content th {
      background-color: #f5f5f5;
      font-weight: 600;
    }

    .ds-message-content a {
      color: #2964aa;
      text-decoration: none;
      font-weight: 500;
      border-bottom: 1px solid #2964aa;
      padding-bottom: 1px;
      transition: all 0.2s ease;
    }

    .ds-message-content a:hover {
      color: #1a4b8c;
      border-bottom-color: #1a4b8c;
    }
  `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)
    const diffInWeeks = Math.floor(diffInDays / 7)
    const diffInMonths = Math.floor(diffInDays / 30)

    if (diffInMonths > 0) {
      return `Hace ${diffInMonths} ${diffInMonths === 1 ? "mes" : "meses"}`
    } else if (diffInWeeks > 0) {
      return `Hace ${diffInWeeks} ${diffInWeeks === 1 ? "semana" : "semanas"}`
    } else if (diffInDays > 0) {
      return `Hace ${diffInDays} ${diffInDays === 1 ? "día" : "días"}`
    } else if (diffInHours > 0) {
      return `Hace ${diffInHours} ${diffInHours === 1 ? "hora" : "horas"}`
    } else if (diffInMinutes > 0) {
      return `Hace ${diffInMinutes} ${diffInMinutes === 1 ? "minuto" : "minutos"}`
    } else {
      return "Hace un momento"
    }
  }

  // Función para filtrar chats por término de búsqueda
  const filterChatsBySearch = (chats, query) => {
    if (!query.trim()) return chats

    const searchTerm = query.toLowerCase().trim()

    return chats.filter((chat) => {
      const title = chat.title === "NUEVA_CONEXION" ? "Nueva conversación" : chat.title
      const titleLower = title.toLowerCase()

      // Búsqueda simple: si el título contiene el término de búsqueda
      return titleLower.includes(searchTerm)
    })
  }

  // En la función formatTimeAgo, agregar una nueva función para agrupar por fechas
  const groupChatsByDate = (chats) => {
    const groups = {}
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    chats.forEach((chat) => {
      const chatDate = new Date(chat.updatedAt || chat.created_at)
      const chatDateOnly = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate())
      const diffInDays = Math.floor((today - chatDateOnly) / (1000 * 60 * 60 * 24))

      let groupKey
      if (diffInDays === 0) {
        groupKey = "Hoy"
      } else if (diffInDays === 1) {
        groupKey = "Ayer"
      } else if (diffInDays <= 7) {
        groupKey = "Hace una semana"
      } else if (diffInDays <= 30) {
        groupKey = "Hace un mes"
      } else {
        // Para fechas más antiguas, mostrar la fecha absoluta
        const options = { day: "numeric", month: "long" }
        groupKey = chatDate.toLocaleDateString("es-ES", options)
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(chat)
    })

    return groups
  }

  // Actualizar las fechas cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUpdate((prev) => prev + 1)
    }, 60000) // 60000 ms = 1 minuto

    return () => clearInterval(interval)
  }, [])

  // Debounce para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150) // 150ms de delay

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleDeleteChat = async (conversationId, e) => {
    e.stopPropagation()
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return

      const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Error al eliminar la conversación")
      }

      // Actualiza el historial localmente
      setChatHistory((prev) => prev.filter((chat) => chat.id !== conversationId))

      // Si el chat eliminado es el actual, limpia la vista
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null)
        setChatMessages([])
        setSearchParams({})
      }
    } catch (error) {
      console.error("Error al eliminar la conversación:", error)
      // Puedes mostrar un mensaje de error al usuario si lo deseas
    }
  }

  // Función para mostrar más elementos del historial
  const handleShowMoreHistory = () => {
    setHistorialItemsToShow(prev => prev + HISTORIAL_INCREMENT)
  }

  // Función para obtener chats limitados por paginación
  const getLimitedChatHistory = () => {
    const groupedChats = groupChatsByDate(chatHistory)
    const limitedGroups = {}
    let totalShown = 0

    for (const [dateGroup, chats] of Object.entries(groupedChats)) {
      if (totalShown >= historialItemsToShow) break
      
      const remainingSlots = historialItemsToShow - totalShown
      const chatsToShow = chats.slice(0, remainingSlots)
      
      if (chatsToShow.length > 0) {
        limitedGroups[dateGroup] = chatsToShow
        totalShown += chatsToShow.length
      }
    }

    return {
      groups: limitedGroups,
      hasMore: totalShown < chatHistory.length
    }
  }

  return (
    <div className="ds-home-container">
      <style>
        {`
          @keyframes gradient-slide {
  0% {
    background-position: 400% 0;
  }
  100% {
    background-position: -400% 0;
  }
}

@keyframes gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.thinking-message {
  background: linear-gradient(90deg, #666666, #cccccc, #999999, #666666);
  background-size: 400% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: gradient-slide 6s ease-in-out infinite;

  font-size: 15px;
  letter-spacing: 0.5px;
  white-space: pre-wrap !important;
  word-break: break-all !important;
  overflow-wrap: break-word !important;
  line-height: 1.6;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  border-left: 3px solid #cccccc;
  margin: 8px 0;
  display: block;
  width: 100%;
}

.thinking-message p {
  white-space: pre-wrap !important;
  word-break: break-all !important;
  overflow-wrap: break-word !important;
  margin: 0 !important;
}

.ai-thinking-text {
  background: linear-gradient(90deg, #666666, #cccccc, #999999, #666666);
  background-size: 400% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: gradient-slide 6s ease-in-out infinite;
  font-weight: normal;
  display: inline-block;
}



}
        `}
      </style>

      {/* Sidebar */}
      {isMobile && mobileSidebarOpen && (
        <div className="ds-mobile-overlay" onClick={() => setMobileSidebarOpen(false)}></div>
      )}

      <div
        className={`ds-sidebar ${
          isMobile
            ? mobileSidebarOpen
              ? "ds-sidebar-mobile-open"
              : "ds-sidebar-mobile-closed"
            : sidebarOpen
              ? "ds-sidebar-expanded"
              : "ds-sidebar-collapsed"
        }`}
      >
        {sidebarOpen || mobileSidebarOpen ? (
          <>
            <div className="ds-sidebar-header">
              <div className="ds-logo-sidebar-container">
                <img src="/logo-crop2.png" alt="Logo" className="ds-collapsed-logo-img" />
              </div>
              {isMobile && (
                <button className="ds-mobile-close-button" onClick={() => setMobileSidebarOpen(false)}>
                  ×
                </button>
              )}
            </div>

                          <div className="ds-sidebar-content">
                {/* Navegación principal */}
                <div className="ds-navigation-menu">
                <button className="ds-nav-item" onClick={() => setSearchModalOpen(true)}>
                    <Search size={16} />
                    <span>Buscar</span>
                  </button>

                <button className="ds-nav-item ds-close-sidebar-btn" onClick={toggleSidebar}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M4 12v-6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8" />
                    <path d="M20 18h-17" />
                    <path d="M6 15l-3 3l3 3" />
                  </svg>
                  <span>Cerrar </span>
                </button>

                <button className={`ds-nav-item ${activeSection === "chat" ? "active" : ""}`} onClick={() => {
                  handleNewChat()
                  if (isMobile) {
                    setMobileSidebarOpen(false)
                  }
                }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
                    />
                  </svg>
                  <span>Chat</span>
                </button>

                <button
                  className="ds-nav-item"
                  onClick={() => navigate('/semillasencamara')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>Semillas en Cámara</span>
                </button>

                <button
                  className="ds-nav-item"
                  onClick={() => navigate('/partidasriesgo')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span>Partidas Riesgo</span>
                </button>

                <button
                  className={`ds-nav-item${historialExpanded ? " active" : ""}`}
                  onClick={() => {
                    if (activeSection !== "historial") {
                      setActiveSection("historial")
                      setHistorialExpanded(true)
                      setHistorialItemsToShow(10) // Reiniciar paginación
                    } else {
                      setHistorialExpanded(!historialExpanded)
                      if (!historialExpanded) {
                        setHistorialItemsToShow(10) // Reiniciar paginación al abrir
                      }
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M12 7v5l4 2" />
                  </svg>
                  <span>Historial</span>
                </button>
              </div>

              {/* Contenido dinámico basado en la sección activa */}
              {activeSection === "historial" && (
                <div className="ds-section-content">
                  {historialExpanded && (
                    <div className="ds-historial-content">
                      {(() => {
                        const { groups, hasMore } = getLimitedChatHistory()
                        return (
                          <>
                            {Object.entries(groups).map(([dateGroup, chats]) => (
                              <div key={dateGroup} className="ds-date-group">
                                <div className="ds-date-header">{dateGroup}</div>
                                {chats.map((chat) => (
                                  <button
                                    key={`${chat.id}-${timeUpdate}`}
                                    onClick={() => handleConversationClick(chat.id)}
                                    className={`ds-historial-item ${currentConversationId === chat.id ? "active" : ""}`}
                                  >
                                    <span className="ds-historial-title">
                                      {chat.title === "NUEVA_CONEXION" ? "Nueva conversación" : chat.title}
                                    </span>
                                    <button
                                      className="ds-historial-delete-button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteChat(chat.id, e)
                                      }}
                                      title="Eliminar chat"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </button>
                                ))}
                              </div>
                            ))}
                            
                            {hasMore && (
                              <div className="ds-show-more-container">
                                <button 
                                  className="ds-show-more-button"
                                  onClick={handleShowMoreHistory}
                                >
                                  Ver más ({chatHistory.length - historialItemsToShow} restantes)
                                </button>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}

              {activeSection === "chat" && (
                <div className="ds-section-content">
                  {/* The "Nuevo chat" button is removed, so this section is now empty */}
                </div>
              )}
            </div>

            {/* Footer con usuario */}
            <div className="ds-sidebar-footer">
              <div className="ds-user-section">
                <div className="ds-user-info">
                  <button className="ds-user-circle" onClick={() => {
                    setUserMenuOpen(!userMenuOpen)
                    if (isMobile) {
                      setMobileSidebarOpen(false)
                    }
                  }}>
                    {getUserAvatar()}
                  </button>
                </div>
              </div>
              {/* Modal del usuario */}
            </div>
          </>
        ) : (
          <div className="ds-sidebar-collapsed-content">
            {/* Header colapsado */}
            <div className="ds-sidebar-header">
              <div className="ds-logo-sidebar-container">
                <img src="/logo-crop2.png" alt="Logo" className="ds-collapsed-logo-img" />
              </div>
            </div>

            {/* Contenido colapsado */}
            <div className="ds-sidebar-content">
              <div className="ds-navigation-menu">
                <button className="ds-nav-item" onClick={() => setSearchModalOpen(true)}>
                  <Search size={16} />
                </button>

                <button className="ds-nav-item ds-close-sidebar-btn" onClick={toggleSidebar}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M20 12v-6a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v8" />
                    <path d="M4 18h17" />
                    <path d="M18 15l3 3l-3 3" />
                  </svg>
                </button>

                <button
                  className={`ds-nav-item ${activeSection === "chat" ? "active" : ""}`}
                  onClick={() => {
                    handleNewChat()
                    if (!sidebarOpen) toggleSidebar()
                  }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
                    />
                  </svg>
                </button>

                <button
                  className={`ds-nav-item ${activeSection === "tareas" ? "active" : ""}`}
                  onClick={() => {
                    setActiveSection("tareas")
                    if (!sidebarOpen) toggleSidebar()
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3l8-8" />
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.51 0 2.93.37 4.18 1.03" />
                  </svg>
                </button>

                <button
                  className={`ds-nav-item ${activeSection === "historial" ? "active" : ""}`}
                  onClick={() => {
                    if (activeSection !== "historial") {
                    setActiveSection("historial")
                    setHistorialExpanded(true)
                    setHistorialItemsToShow(10) // Reiniciar paginación
                    } else {
                      setHistorialExpanded(!historialExpanded)
                      if (!historialExpanded) {
                        setHistorialItemsToShow(10) // Reiniciar paginación al abrir
                      }
                    }
                    if (!sidebarOpen) toggleSidebar()
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M12 7v5l4 2" />
                  </svg>
                </button>
              </div>

              {activeSection === "chat" && (
                <div className="ds-section-content">
                  {/* The "Nuevo chat" button is removed, so this section is now empty */}
                </div>
              )}
            </div>

            {/* Footer colapsado */}
            <div className="ds-sidebar-footer">
              <div className="ds-user-section">
                <div className="ds-user-info">
                  <button className="ds-user-circle" onClick={() => {
                    setUserMenuOpen(!userMenuOpen)
                    if (isMobile) {
                      setMobileSidebarOpen(false)
                    }
                  }}>
                    {getUserAvatar()}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="ds-main-content" ref={mainContentRef}>
        <div className="ds-chat-header">
          {isMobile && (
            <button className="ds-mobile-menu-button" onClick={toggleSidebar}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="24" height="24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
              </svg>
            </button>
          )}
          <div className="ds-chat-header-title">
            <button 
              className={`ds-header-option ${activeHeaderOption === "chat" ? "active" : ""}`}
              onClick={() => {
                setActiveHeaderOption("chat")
                setIsVoiceMode(false)
                stopVoiceMode()
              }}
            >
              Chat
            </button>
            <div className="ds-header-separator"></div>
            <button 
              className={`ds-header-option ${activeHeaderOption === "voz" ? "active" : ""}`}
              onClick={async () => {
                setActiveHeaderOption("voz")
                setIsVoiceMode(true)
                await initializeVoiceMode()
              }}
            >
              Voz
            </button>
          </div>
          {isMobile && (
            <button className="ds-mobile-new-chat-button" onClick={() => {
              handleNewChat()
              setMobileSidebarOpen(false)
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M12.007 19.98a9.869 9.869 0 0 1 -4.307 -.98l-4.7 1l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c1.992 1.7 2.93 4.04 2.747 6.34" />
                <path d="M16 19h6" />
                <path d="M19 16v6" />
              </svg>
            </button>
          )}
        </div>


        <div className="ds-chat-layout">
          {isChatEmpty ? (
            <div className="ds-initial-view">
              <div className="ds-welcome-message">
                <div className="ds-welcome-logo">
                  <img src="/logo-crop2.png" alt="Logo" />
                </div>
                <h2>Hola {getUserFirstName()}</h2>
                <p>¿En qué puedo ayudarte hoy?</p>
              </div>
            </div>
          ) : (
            <div className="ds-chat-messages-container" ref={chatContainerRef}>
              <div className="ds-chat-messages">
                <div className="ds-message ds-bot-message">
                  <div className="ds-message-avatar">
                    <img src="/logo-crop2.png" alt="Logo" className="ds-avatar-image" />
                  </div>
                  <div className="ds-message-content">
                    <h2>Hola {getUserFirstName()}</h2>
                    <p>¿En qué puedo ayudarte hoy?</p>
                  </div>
                </div>

                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`ds-message ${msg.sender === "bot" ? "ds-bot-message" : "ds-user-message"}`}
                  >
                    {msg.sender === "bot" && (
                      <div className="ds-message-avatar">
                        <img src="/logo-crop2.png" alt="Logo" className="ds-avatar-image" />
                      </div>
                    )}
                    <div className="ds-message-content">
                      {msg.sender === "bot" ? (
                        <div className="markdown-content">
                          {msg.isVoice && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#9c27b0',
                              fontSize: '12px',
                              fontWeight: '500',
                              marginBottom: '8px'
                            }}>
                              <AudioLines size={14} />
                              <span>Respuesta de voz con Alloy</span>
                            </div>
                          )}
                          {msg.isThinking && msg.trace && msg.trace.length > 0 ? (
                            <AgentTrace steps={msg.trace} />
                          ) : (
                            <div className={msg.isThinking ? "thinking-message" : ""}>
                              {console.log("🔍 [FRONTEND] Contenido que recibe ReactMarkdown:", msg.text)}
                              <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath, remarkEmoji]}
                              rehypePlugins={[
                                rehypeKatex,
                                [rehypeHighlight, { detect: true, ignoreMissing: true }],
                                rehypeRaw
                              ]}
                              // ⚡ CONFIGURACIÓN INTELIGENTE - LA IA CONTROLA FORMATO
                              children={msg.text}
                              components={{
                                p: ({ children }) => {
                                  const text = typeof children === 'string' ? children : 
                                             Array.isArray(children) ? children.join('') : 
                                             children?.toString() || '';
                                  
                                  if (text.includes('Buscandoo información en el ERP')) {
                                    return (
                                      <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <UserSearch size={16} style={{ color: '#007acc', flexShrink: 0 }} />
                                        {children}
                                      </p>
                                    );
                                  }
                                  return <p>{children}</p>;
                                },
                                ul: ({ children, ...props }) => {
                                  // Detectar si la IA quiere viñetas especiales
                                  const content = typeof children === 'string' ? children : 
                                                Array.isArray(children) ? children.join('') : 
                                                children?.toString() || '';
                                  
                                  // Si contiene emojis o caracteres especiales, usar viñetas personalizadas
                                  if (content.includes('•') || content.includes('→') || content.includes('✓')) {
                                    return <ul style={{ listStyleType: 'none', paddingLeft: '0' }} {...props}>{children}</ul>;
                                  }
                                  
                                  // Por defecto, usar viñetas redondas
                                  return <ul style={{ listStyleType: 'disc' }} {...props}>{children}</ul>;
                                },
                                ol: ({ children, ...props }) => {
                                  // Numeración por defecto
                                  return <ol style={{ listStyleType: 'decimal' }} {...props}>{children}</ol>;
                                },
                                table: ({ children, ...props }) => {
                                  return (
                                    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                                      <table style={{ 
                                        borderCollapse: 'collapse', 
                                        width: '100%',
                                        border: '1px solid #ddd'
                                      }} {...props}>
                                        {children}
                                      </table>
                                    </div>
                                  );
                                },
                                th: ({ children, ...props }) => {
                                  return (
                                    <th style={{ 
                                      border: '1px solid #ddd', 
                                      padding: '8px', 
                                      backgroundColor: '#f5f5f5',
                                      fontWeight: '600',
                                      textAlign: 'left'
                                    }} {...props}>
                                      {children}
                                    </th>
                                  );
                                },
                                td: ({ children, ...props }) => {
                                  return (
                                    <td style={{ 
                                      border: '1px solid #ddd', 
                                      padding: '8px',
                                      textAlign: 'left'
                                    }} {...props}>
                                      {children}
                                    </td>
                                  );
                                }
                              }}
                            >
                              {msg.text || ""}
                            </ReactMarkdown>
                            </div>
                          )}
                          {msg.isStreaming && !msg.text && (
                            <div className="ds-typing-container">
                              <div className="ds-typing-indicator-inline">
                                <span></span>
                                <span></span>
                                <span></span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {msg.image && (
                            <div style={{
                              marginBottom: '8px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              maxWidth: '300px'
                            }}>
                              <img
                                src={URL.createObjectURL(msg.image.file)}
                                alt={msg.image.name}
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  display: 'block'
                                }}
                              />
                              <div style={{
                                fontSize: '12px',
                                color: '#666',
                                marginTop: '4px',
                                padding: '4px 8px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '4px'
                              }}>
                                📷 {msg.image.name} ({(msg.image.size / 1024 / 1024).toFixed(1)} MB)
                              </div>
                            </div>
                          )}
                          {msg.text && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {msg.isVoice && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#2196f3',
                                  fontSize: '12px',
                                  fontWeight: '500'
                                }}>
                                  <AudioLines size={14} />
                                  <span>Mensaje de voz</span>
                                </div>
                              )}
                              <p 
                                style={{ whiteSpace: "pre-line" }}
                                className={msg.isThinking ? "thinking-message" : ""}
                              >
                                {msg.text}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {showScrollButton && !isChatEmpty && (
            <div className="ds-scroll-button-container" style={getScrollButtonStyle()}>
              <button className="ds-scroll-to-bottom" onClick={scrollToBottom}>
                <ChevronDown size={16} />
              </button>
            </div>
          )}

          <div className="ds-chat-input-container">
            {/* Input oculto para seleccionar imágenes */}
            <input
              type="file"
              id="chat-image-input"
              accept="image/*"
              onChange={handleImageUploadForChat}
              style={{ display: 'none' }}
            />
            <form onSubmit={handleSubmit}>
              <div className="ds-input-wrapper">
                <div style={{ position: 'relative', width: '100%' }}>
                  {/* Botón para agregar imagen */}
                  <button
                    type="button"
                    onClick={handleImageSelectForChat}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: selectedImage ? '#e3f2fd' : 'none',
                      border: selectedImage ? '2px solid #2196f3' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10,
                      color: selectedImage ? '#2196f3' : '#666',
                      transition: 'all 0.2s ease',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.color = selectedImage ? '#1976d2' : '#333'
                      e.target.style.backgroundColor = selectedImage ? '#bbdefb' : '#f5f5f5'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.color = selectedImage ? '#2196f3' : '#666'
                      e.target.style.backgroundColor = selectedImage ? '#e3f2fd' : 'transparent'
                    }}
                    title="Agregar imagen (JPG, PNG, GIF - máx. 10MB)"
                  >
                    <CirclePlus size={20} />
                  </button>
                  {isVoiceMode ? (
                    // Interfaz de modo de voz
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px 20px',
                      backgroundColor: isListening ? '#e3f2fd' : isSpeaking ? '#f3e5f5' : '#f8f9fa',
                      border: `2px solid ${isListening ? '#2196f3' : isSpeaking ? '#9c27b0' : '#e9ecef'}`,
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      minHeight: '48px'
                    }}>
                      {isListening ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#2196f3' }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: '#2196f3',
                            animation: 'pulse 1.5s infinite'
                          }}></div>
                          <span style={{ fontWeight: '500' }}>Escuchando... Habla ahora</span>
                        </div>
                      ) : isSpeaking ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#9c27b0' }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: '#9c27b0',
                            animation: 'pulse 1s infinite'
                          }}></div>
                          <span style={{ fontWeight: '500' }}>Deitana está respondiendo con voz...</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#666' }}>
                          <AudioLines size={20} />
                          <span>Modo de voz activo - Habla para consultar</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Interfaz de modo chat normal
                    <input
                      type="text"
                      placeholder={isRecording || isTranscribing ? "" : "¿Cómo puede ayudar Deitana IA?"}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="ds-chat-input"
                      disabled={isRecording || isTranscribing}
                      style={{
                        backgroundColor: isRecording || isTranscribing ? '#f8f9fa' : 'white',
                        color: 'inherit',
                        paddingLeft: '45px'
                      }}
                    />
                  )}
                  
                  {/* Vista previa de imagen seleccionada */}
                  {selectedImage && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '0',
                      right: '0',
                      marginBottom: '8px',
                      padding: '8px',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      zIndex: 20
                    }}>
                      <img
                        src={URL.createObjectURL(selectedImage)}
                        alt="Vista previa"
                        style={{
                          width: '40px',
                          height: '40px',
                          objectFit: 'cover',
                          borderRadius: '4px'
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: '#333',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {selectedImage.name}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#666'
                        }}>
                          {(selectedImage.size / 1024 / 1024).toFixed(1)} MB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeSelectedImage}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#666',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        title="Eliminar imagen"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  
                  {/* Overlay de ondas de audio con estilo profesional */}
                  {isRecording && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '50px',
                      gap: '2px',
                      opacity: 1,
                      width: '200px',
                      pointerEvents: 'none'
                    }}>
                      {Array.from({ length: 10 }, (_, index) => {
                        const heights = [12, 18, 25, 15, 28, 20, 16, 22, 18, 14];
                        const delays = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
                        const durations = [0.9, 0.7, 1.1, 0.6, 1.3, 0.8, 0.9, 1.0, 0.7, 1.2];
                        
                        return (
                          <div
                            key={index}
                            className={`wave wave-${index + 1}`}
                            style={{
                              width: '3px',
                              height: `${heights[index]}px`,
                              background: 'linear-gradient(to top, #667eea, #764ba2)',
                              borderRadius: '2px',
                              animation: `wave-animation ${durations[index]}s ease-in-out infinite`,
                              animationDelay: `${delays[index]}s`
                            }}
                          />
                        );
                      })}
                      <style jsx>{`
                        @keyframes wave-animation {
                          0%, 100% {
                            transform: scaleY(0.5);
                            opacity: 0.7;
                          }
                          50% {
                            transform: scaleY(1);
                            opacity: 1;
                          }
                        }
                      `}</style>
                    </div>
                  )}
                  
                  {/* Texto de transcripción */}
                  {isTranscribing && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '16px',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      pointerEvents: 'none'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #0066ff',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <span style={{
                        fontSize: '14px',
                        color: '#0066ff',
                        fontWeight: '500'
                      }}>
                        🎤 Transcribiendo tu voz a texto...
                      </span>
                      <style jsx>{`
                        @keyframes spin {
                          0% { transform: rotate(0deg); }
                          100% { transform: rotate(360deg); }
                        }
                      `}</style>
                    </div>
                  )}
                </div>
                {isRecording || isTranscribing ? (
                  <div style={{ 
                    position: 'absolute', 
                    right: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <button 
                      type="button" 
                      className="ds-send-button"
                      style={{
                        position: 'relative',
                        right: 'auto',
                        backgroundColor: '#ff4444',
                        color: 'white'
                      }}
                      onClick={handleSquareClick}
                      disabled={isTranscribing && !isTranscriptionPaused}
                    >
                      <Square size={18} />
                    </button>
                    <button 
                      type="button" 
                      className="ds-send-button"
                      style={{
                        position: 'relative',
                        right: 'auto'
                      }}
                      onClick={handleArrowUpClick}
                      disabled={!message.trim() && !selectedImage}
                    >
                      <ArrowUp size={18} />
                    </button>
                  </div>
                ) : (message.trim() || selectedImage) ? (
                  <button 
                    type="submit" 
                    className="ds-send-button" 
                    disabled={false}
                  >
                    <ArrowUp size={20} />
                  </button>
                ) : (
                  <div style={{ 
                    position: 'absolute', 
                    right: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <button 
                      type="button" 
                      className="ds-send-button"
                      style={{
                        position: 'relative',
                        right: 'auto',
                        backgroundColor: message.trim() ? '#e3f2fd' : 'transparent',
                        border: message.trim() ? '2px solid #2196f3' : 'none',
                        color: message.trim() ? '#2196f3' : 'inherit'
                      }}
                      onClick={handleMicClick}
                      title={message.trim() ? "Texto transcrito listo - Haz clic para grabar de nuevo" : "Grabar audio para transcribir"}
                    >
                      <Mic size={18} />
                    </button>
                    <button 
                      type="button" 
                      className="ds-send-button"
                      style={{
                        position: 'relative',
                        right: 'auto',
                        backgroundColor: isVoiceAssistantActive ? '#10a37f' : 'transparent',
                        color: isVoiceAssistantActive ? 'white' : 'inherit'
                      }}
                      onClick={toggleVoiceAssistant}
                      disabled={isProcessingVoice}
                      title={isVoiceAssistantActive ? 'Desactivar asistente de voz' : 'Activar asistente de voz'}
                    >
                      {isVoiceRecording ? (
                        <div className="pulse-animation">
                          <AudioLines size={18} />
                        </div>
                      ) : (
                        <AudioLines size={18} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </form>
            
            {/* Indicador de estado del asistente de voz */}
            {isVoiceAssistantActive && (
              <div style={{
                padding: '8px 16px',
                backgroundColor: isVoiceRecording ? '#10a37f' : (isSpeaking ? '#0066cc' : '#f3f4f6'),
                color: isVoiceRecording || isSpeaking ? 'white' : '#374151',
                borderRadius: '8px',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.3s ease'
              }}>
                {isProcessingVoice ? (
                  <>
                    <div className="spinner" style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Procesando...
                  </>
                ) : isVoiceRecording ? (
                  <>
                    <div className="pulse-animation">
                      <div style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: 'white',
                        borderRadius: '50%'
                      }}></div>
                    </div>
                    Escuchando...
                  </>
                ) : isSpeaking ? (
                  <>
                    🔊 Hablando...
                  </>
                ) : (
                  'Asistente de voz activo'
                )}
              </div>
            )}
            
            <div className="ds-disclaimer">Deitana IA</div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {userMenuOpen && <div className="modal-backdrop" onClick={() => {
          setUserMenuOpen(false)
          // Resetear al menú principal cuando se cierra
          setTimeout(() => setModalView("main"), 300)
        }} />}

      {/* Bottom Sheet para móvil */}
      {isMobile && userMenuOpen && (
        <div
          className={`modal-sheet ${userMenuOpen ? "modal-open" : ""}`}
          style={{
            transform: `translateY(${dragY}px)`,
            transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="modal-handle" />

          <div className="modal-content">
            {/* Header con botón de volver atrás si no estamos en el menú principal */}
            {modalView !== "main" && modalView !== "" && modalView && (
              <div className="modal-header-with-back">
                <button className="back-button" onClick={() => setModalView("main")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5m7-7l-7 7 7 7" />
                  </svg>
                </button>
                <div className="back-button-spacer"></div>
                <div className="back-button-spacer"></div>
              </div>
            )}

            {/* Menú principal */}
            {(modalView === "main" || modalView === "" || !modalView) && (
              <div className="menu-list">
              <div className="menu-item" onClick={() => setModalView("account")}>
                <span className="menu-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span className="menu-title">Cuenta</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item" onClick={() => setModalView("appearance")}>
                <span className="menu-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
                    <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
                  </svg>
                </span>
                <span className="menu-title">Configuración</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item" onClick={() => setModalView("behavior")}>
                <span className="menu-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </span>
                <span className="menu-title">Comportamiento</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item" onClick={() => setModalView("personalize")}>
                <span className="menu-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 0 1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <span className="menu-title">Personalizar</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item" onClick={() => setModalView("data")}>
                <span className="menu-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <rect x="9" y="9" width="6" height="6" />
                    <path d="M9 1v6M15 1v6M9 21v-6M15 21v-6M1 9h6M1 15h6M21 9h-6M21 15h-6" />
                  </svg>
                </span>
                <span className="menu-title">Controles de datos</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item" onClick={() => setModalView("apps")}>
                <span className="menu-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <rect x="9" y="9" width="6" height="6" />
                    <path d="M9 1v6M15 1v6M9 21v-6M15 21v-6M1 9h6M1 15h6M21 9h-6M21 15h-6" />
                  </svg>
                </span>
                <span className="menu-title">Apps conectadas</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item" onClick={handleLogout}>
                <span className="menu-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m0 14l6-6-6-6m6 6H9" />
                  </svg>
                </span>
                <span className="menu-title">Cerrar sesión</span>
                <span className="menu-arrow">›</span>
              </div>
            </div>
            )}

            {/* Contenido específico de cada sección */}
            {modalView === "account" && (
              <div className="section-content">
                <div className="ds-user-profile-card">
                  <div className="ds-user-avatar-large">
                    {getUserAvatar()}
                  </div>
                  <div className="ds-user-info-large">
                    <div className="ds-user-name-large">{user?.displayName || "Usuario"}</div>
                    <div className="ds-user-email-large">{user?.email || ""}</div>
                  </div>

                </div>
                <div className="ds-id-section">{user?.uid || ""}</div>
              </div>
            )}

            {modalView === "appearance" && (
              <div className="section-content">
                <div className="ds-config-section">
                  <div className="ds-config-item">
                    <label className="ds-config-label">Imagen</label>
                    <div className="ds-profile-image-section">
                      <div className="ds-user-avatar-config">
                        {getUserAvatar()}
                      </div>
                      <button className="ds-edit-image-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        Editar imagen
                      </button>
                    </div>
                  </div>

                  <div className="ds-config-item">
                    <label className="ds-config-label">Nombre</label>
                    <div className="ds-input-with-button">
                      <input
                        type="text"
                        className="ds-config-input"
                        defaultValue={user?.displayName || ""}
                        placeholder="Ingresa tu nombre"
                      />
                      <button className="ds-input-button">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Sección de contraseña */}
                  <div className="ds-config-item">
                    <label className="ds-config-label">Contraseña</label>
                    <div className="ds-password-section">
                      <div className="ds-input-with-button">
                        <input
                          type="password"
                          className="ds-config-input"
                          defaultValue="password123"
                          placeholder="Ingresa tu contraseña"
                        />
                        <button className="ds-input-button ds-toggle-password-btn">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                      <button className="ds-change-password-btn">Ver contraseña</button>
                    </div>
                  </div>

                  <div className="ds-config-actions">
                    <button className="ds-save-config-btn">Guardar cambios</button>
                  </div>
                </div>
              </div>
            )}

            {modalView === "behavior" && (
              <div className="section-content">
                <p>Configuración de comportamiento próximamente...</p>
              </div>
            )}

            {modalView === "personalize" && (
              <div className="section-content">
                <p>Opciones de personalización próximamente...</p>
              </div>
            )}

            {modalView === "data" && (
              <div className="section-content">
                <p>Controles de datos próximamente...</p>
              </div>
            )}

            {modalView === "apps" && (
              <div className="section-content">
                <p>Apps conectadas próximamente...</p>
              </div>
            )}


          </div>
        </div>
      )}

      {/* Modal Desktop */}
      {!isMobile && userMenuOpen && (
        <div className="ds-user-modal-overlay" onClick={() => setUserMenuOpen(false)}>
          <div className="ds-user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-user-modal-header">
              <h2 className="ds-user-modal-title">
                {modalView === "account"
                  ? "Cuenta"
                  : modalView === "appearance"
                    ? "Configuración"
                    : modalView === "behavior"
                      ? "Comportamiento"
                      : modalView === "personalize"
                        ? "Personalizar"
                        : modalView === "data"
                          ? "Controles de datos"
                          : modalView === "apps"
                            ? "Apps conectadas"
                            : "Configuración"}
              </h2>
              <button
                className="ds-user-modal-close"
                onClick={() => {
                  setUserMenuOpen(false)
                  setModalView("main")
                }}
              >
                ×
              </button>
            </div>

            <div className="ds-user-modal-content">
              <div className="ds-user-modal-sidebar">
                <button
                  className={`ds-modal-nav-item ${(modalView === "account" || modalView === "main") ? "active" : ""}`}
                  onClick={() => setModalView("account")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Cuenta</span>
                </button>

                <button
                  className={`ds-modal-nav-item ${modalView === "appearance" ? "active" : ""}`}
                  onClick={() => setModalView("appearance")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
                    <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
                  </svg>
                  <span>Configuración</span>
                </button>

                <button
                  className={`ds-modal-nav-item ${modalView === "behavior" ? "active" : ""}`}
                  onClick={() => setModalView("behavior")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>Comportamiento</span>
                </button>

                <button
                  className={`ds-modal-nav-item ${modalView === "personalize" ? "active" : ""}`}
                  onClick={() => setModalView("personalize")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 0 1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>Personalizar</span>
                </button>

                <button
                  className={`ds-modal-nav-item ${modalView === "data" ? "active" : ""}`}
                  onClick={() => setModalView("data")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <rect x="9" y="9" width="6" height="6" />
                    <path d="M9 1v6M15 1v6M9 21v-6M15 21v-6M1 9h6M1 15h6M21 9h-6M21 15h-6" />
                  </svg>
                  <span>Controles de datos</span>
                </button>

                <button
                  className={`ds-modal-nav-item ${modalView === "apps" ? "active" : ""}`}
                  onClick={() => setModalView("apps")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <rect x="9" y="9" width="6" height="6" />
                    <path d="M9 1v6M15 1v6M9 21v-6M15 21v-6M1 9h6M1 15h6M21 9h-6M21 15h-6" />
                  </svg>
                  <span>Apps conectadas</span>
                </button>
              </div>

              <div className="ds-user-modal-main">
                {(modalView === "account" || modalView === "main" || !modalView) && (
                  <>
                <div className="ds-user-profile-card">
                  <div className="ds-user-avatar-large">
                        {getUserAvatar()}
                  </div>
                  <div className="ds-user-info-large">
                        <div className="ds-user-name-large">{user?.displayName || "Usuario"}</div>
                        <div className="ds-user-email-large">{user?.email || ""}</div>
                  </div>

                </div>

                <div className="ds-language-section">
                  <span className="ds-language-text">Cerrar sesión</span>
                  <button className="ds-admin-btn" onClick={handleLogout}>
                    Cerrar sesión
                  </button>
                </div>

                    <div className="ds-id-section">{user?.uid || ""}</div>
                  </>
                )}



                {modalView === "appearance" && (
                  <div className="ds-config-section">
                    {/* Sección de imagen de perfil */}
                    <div className="ds-config-item">
                      <label className="ds-config-label">Imagen</label>
                      <div className="ds-profile-image-section">
                        <div className="ds-user-avatar-config">
                          {getUserAvatar()}
            </div>
                        <button 
                          className="ds-edit-image-btn"
                          onClick={handleImageSelect}
                          disabled={isUpdatingProfile}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          {isUpdatingProfile ? "Subiendo..." : "Editar imagen"}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Sección de nombre */}
                    <div className="ds-config-item">
                      <label className="ds-config-label">Nombre</label>
                      <div className="ds-input-with-button">
                        <input
                          type="text"
                          className="ds-config-input"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Ingresa tu nombre"
                          disabled={isUpdatingProfile}
                        />
                        <button className="ds-input-button">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Sección de contraseña */}
                    <div className="ds-config-item">
                      <label className="ds-config-label">Contraseña actual</label>
                      <div className="ds-password-section">
                        <div className="ds-input-with-button">
                          <input
                            type={showPassword ? "text" : "password"}
                            className="ds-config-input"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Contraseña actual"
                            disabled={isUpdatingProfile}
                          />
                          <button 
                            className="ds-input-button ds-toggle-password-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            type="button"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sección de nueva contraseña */}
                    <div className="ds-config-item">
                      <label className="ds-config-label">Nueva contraseña</label>
                      <div className="ds-password-section">
                        <div className="ds-input-with-button">
                          <input
                            type={showPassword ? "text" : "password"}
                            className="ds-config-input"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Nueva contraseña (opcional)"
                            disabled={isUpdatingProfile}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mensajes de error y éxito */}
                    {profileError && (
                      <div style={{
                        color: '#dc3545',
                        fontSize: '14px',
                        textAlign: 'center',
                        padding: '8px',
                        backgroundColor: '#f8d7da',
                        borderRadius: '4px',
                        margin: '16px 0'
                      }}>
                        {profileError}
                      </div>
                    )}
                    
                    {profileSuccess && (
                      <div style={{
                        color: '#155724',
                        fontSize: '14px',
                        textAlign: 'center',
                        padding: '8px',
                        backgroundColor: '#d4edda',
                        borderRadius: '4px',
                        margin: '16px 0'
                      }}>
                        {profileSuccess}
                      </div>
                    )}

                    {/* Botón de guardar */}
                    <div className="ds-config-actions">
                      <button 
                        className="ds-save-config-btn"
                        onClick={handleSaveChanges}
                        disabled={isUpdatingProfile}
                      >
                        {isUpdatingProfile ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                )}

                {modalView === "behavior" && (
                  <div>
                    <p>Configuración de comportamiento próximamente...</p>
                  </div>
                )}

                {modalView === "personalize" && (
                  <div>
                    <p>Opciones de personalización próximamente...</p>
                  </div>
                )}

                {modalView === "data" && (
                  <div>
                    <p>Controles de datos próximamente...</p>
                  </div>
                )}

                {modalView === "apps" && (
                  <div>
                    <p>Apps conectadas próximamente...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Search Modal */}
      {!isMobile && searchModalOpen && (
        <div 
          className="ds-search-modal-overlay"
          onClick={() => {
            setSearchModalOpen(false)
            setSearchQuery("")
            setDebouncedSearchQuery("")
          }}
        >
          <div className="ds-search-modal" onClick={(e) => e.stopPropagation()}>
            {/* Campo de búsqueda fijo */}
            <div className="ds-search-field-container">
              <div className="ds-search-field-wrapper">
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="ds-search-field-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <Search className="ds-search-field-icon" size={20} />
              </div>
            </div>

            {/* Contenedor scrollable para resultados */}
            <div className="ds-search-results-container">
              {/* Secciones dinámicas usando la misma lógica que el historial */}
              {(() => {
                const filteredChats = filterChatsBySearch(chatHistory, debouncedSearchQuery)
                const groupedChats = groupChatsByDate(filteredChats)

                if (debouncedSearchQuery.trim() && filteredChats.length === 0) {
                  return (
                    <div className="ds-search-section">
                      <div className="ds-search-results">
                        <div className="ds-search-result-item" style={{ cursor: "default", opacity: 0.6 }}>
                          <span className="ds-search-result-title">
                            No se encontraron resultados para "{debouncedSearchQuery}"
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }

                return Object.entries(groupedChats).map(([dateGroup, chats]) => (
                  <div key={dateGroup} className="ds-search-section">
                    <div className="ds-search-section-header">
                      <span className="ds-search-section-title">{dateGroup}</span>
                    </div>
                    <div className="ds-search-results">
                      {chats.map((chat) => (
                        <div
                          key={chat.id}
                          className="ds-search-result-item"
                          onClick={() => {
                            handleConversationClick(chat.id)
                            setSearchModalOpen(false)
                            setSearchQuery("")
                            setDebouncedSearchQuery("")
                          }}
                        >
                          <span className="ds-search-result-title">
                            {chat.title === "NUEVA_CONEXION" ? "Nueva conversación" : chat.title}
                          </span>
                          <span className="ds-search-result-time">
                            {formatTimeAgo(chat.updatedAt || chat.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Search Bottom Sheet */}
      {isMobile && searchModalOpen && <div className="modal-backdrop" onClick={() => {
          setSearchModalOpen(false)
          setSearchQuery("")
          setDebouncedSearchQuery("")
        }} />}

      {isMobile && searchModalOpen && (
        <div
          className={`modal-sheet ${searchModalOpen ? "modal-open" : ""}`}
          style={{
            transform: `translateY(${searchDragY}px)`,
            transition: isSearchDragging ? "none" : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onTouchStart={handleSearchTouchStart}
          onTouchMove={handleSearchTouchMove}
          onTouchEnd={handleSearchTouchEnd}
          onMouseDown={handleSearchMouseDown}
        >
          <div className="modal-handle" />

          <div className="modal-content">
            {/* Campo de búsqueda */}
            <div className="search-input-container">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <Search className="search-input-icon" size={20} />
              </div>
            </div>

            {/* Resultados scrollables */}
            <div className="search-results-scrollable">
              {(() => {
                const filteredChats = filterChatsBySearch(chatHistory, debouncedSearchQuery)
                const groupedChats = groupChatsByDate(filteredChats)

                if (debouncedSearchQuery.trim() && filteredChats.length === 0) {
                  return (
                    <div className="search-section">
                      <div className="search-no-results">
                        <span className="search-no-results-text">
                          No se encontraron resultados para "{debouncedSearchQuery}"
                        </span>
                      </div>
                    </div>
                  )
                }

                return Object.entries(groupedChats).map(([dateGroup, chats]) => (
                  <div key={dateGroup} className="search-section">
                    <div className="search-section-header">
                      <span className="search-section-title">{dateGroup}</span>
                    </div>
                    <div className="search-results">
                      {chats.map((chat) => (
                        <div
                          key={chat.id}
                          className="search-result-item"
                          onClick={() => {
                            handleConversationClick(chat.id)
                            setSearchModalOpen(false)
                            setSearchQuery("")
                            setDebouncedSearchQuery("")
                          }}
                        >
                          <span className="search-result-title">
                            {chat.title === "NUEVA_CONEXION" ? "Nueva conversación" : chat.title}
                          </span>
                          <span className="search-result-time">
                            {formatTimeAgo(chat.updatedAt || chat.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home










