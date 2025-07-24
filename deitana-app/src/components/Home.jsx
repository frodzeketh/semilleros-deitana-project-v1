"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Send, ChevronDown, Search, Trash2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useAuth } from "../context/AuthContext"
import { auth } from "../components/Authenticator/firebase"
import { useSearchParams } from "react-router-dom"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkEmoji from "remark-emoji"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import rehypeRaw from "rehype-raw"
import "katex/dist/katex.min.css"
import "highlight.js/styles/github.css"

const API_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://semilleros-deitana-project-v1-production.up.railway.app"

const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams()
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

  // Agregar después de los otros estados
  const [activeSection, setActiveSection] = useState("historial")
  const [historialExpanded, setHistorialExpanded] = useState(false)

  // Eliminar la línea donde se declara historialExpanded:
  // const [historialExpanded, setHistorialExpanded] = useState(false)

  // Agregar un nuevo estado para controlar el menú del usuario:
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [modalView, setModalView] = useState("account") // 'main', 'admin', 'appearance', etc.

  // Estado para el modal de búsqueda
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [activeHeaderOption, setActiveHeaderOption] = useState("chat")

  // Estados para el drag del bottom sheet en móvil
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [startY, setStartY] = useState(0)

  // Estados para el drag del search bottom sheet
  const [isSearchDragging, setIsSearchDragging] = useState(false)
  const [searchDragY, setSearchDragY] = useState(0)
  const [searchStartY, setSearchStartY] = useState(0)

  // Obtener la función de logout del contexto de autenticación
  const { logout, user } = useAuth()

  // Función para obtener las iniciales del usuario
  const getUserInitials = () => {
    if (!user?.displayName) return "U"
    
    const names = user.displayName.split(" ")
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase()
    }
    return names[0][0].toUpperCase()
  }

  // Función para obtener solo el primer nombre del usuario
  const getUserFirstName = () => {
    if (!user?.displayName) return "Usuario"
    
    const names = user.displayName.split(" ")
    return names[0]
  }

  // Datos de ejemplo para el historial de chats
  const [chatHistory, setChatHistory] = useState([])

  // Agregar estado para forzar la actualización de las fechas
  const [timeUpdate, setTimeUpdate] = useState(0)

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
      setCurrentConversationId(conversationId)
    }
  }, [searchParams])

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

  // Modificar la función handleSubmit para usar la conversación actual
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return

    console.log("🚀 [FRONTEND] === INICIO ENVÍO DE MENSAJE CON STREAMING ===")
    console.log("🚀 [FRONTEND] Mensaje a enviar:", message)
    console.log("🚀 [FRONTEND] Conversation ID actual:", currentConversationId)

    const userMessage = {
      id: Date.now(),
      text: message,
      sender: "user",
    }

    setChatMessages((prev) => [...prev, userMessage])
    setMessage("")
    setIsTyping(true)

    // Crear mensaje del bot con estado de streaming
    const botMessage = {
      id: Date.now() + 1,
      text: "",
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
          conversationId: currentConversationId 
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

      // Función para mostrar contenido de forma más natural
      const naturalFlush = () => {
        // Mostrar contenido cuando tengamos al menos 1-2 caracteres
        if (buffer.length >= 1) {
          flushBuffer()
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
                  naturalFlush() // Mostrar cuando tengamos suficientes caracteres
                } else if (content === ' ' || content === '\n') {
                  // Preservar espacios y saltos de línea
                  buffer += content
                  naturalFlush() // Mostrar el contenido acumulado
                }
                
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

  return (
    <div className="ds-home-container">
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

                <button className={`ds-nav-item ${activeSection === "chat" ? "active" : ""}`} onClick={handleNewChat}>
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
                  className={`ds-nav-item ${activeSection === "tareas" ? "active" : ""}`}
                  onClick={() => setActiveSection("tareas")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3l8-8" />
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.51 0 2.93.37 4.18 1.03" />
                  </svg>
                  <span>Tareas</span>
                </button>

                <button
                  className={`ds-nav-item${historialExpanded ? " active" : ""}`}
                  onClick={() => {
                    if (activeSection !== "historial") {
                      setActiveSection("historial")
                      setHistorialExpanded(true)
                    } else {
                      setHistorialExpanded(!historialExpanded)
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
                      {Object.entries(groupChatsByDate(chatHistory)).map(([dateGroup, chats]) => (
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
                  <button className="ds-user-circle" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                    <span>{getUserInitials()}</span>
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
                    } else {
                      setHistorialExpanded(!historialExpanded)
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
                  <button className="ds-user-circle" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                    <span>{getUserInitials()}</span>
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
              onClick={() => setActiveHeaderOption("chat")}
            >
              Chat
            </button>
            <div className="ds-header-separator"></div>
            <button 
              className={`ds-header-option ${activeHeaderOption === "voz" ? "active" : ""}`}
              onClick={() => setActiveHeaderOption("voz")}
            >
              Voz
            </button>
          </div>
          {isMobile && (
            <button className="ds-mobile-new-chat-button" onClick={handleNewChat}>
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
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath, remarkEmoji]}
                            rehypePlugins={[
                              rehypeKatex,
                              [rehypeHighlight, { detect: true, ignoreMissing: true }],
                              rehypeRaw
                            ]}
                            components={{
                              // Párrafos
                              p: ({ children }) => (
                                <p style={{
                                      whiteSpace: "pre-line",
                                  margin: "12px 0",
                                      lineHeight: "1.6",
                                  color: "#333",
                                  fontSize: "15px"
                                }}>
                                    {children}
                                  </p>
                              ),
                              
                              // Encabezados
                              h1: ({ children }) => (
                                <h1 style={{
                                  fontSize: "1.4em",
                                  fontWeight: "600",
                                  margin: "16px 0 12px 0",
                                    color: "#333",
                                  borderBottom: "2px solid #eee",
                                  paddingBottom: "6px",
                                  lineHeight: "1.3"
                                }}>
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 style={{
                                  fontSize: "1.25em",
                                  fontWeight: "600", 
                                  margin: "16px 0 10px 0",
                                  color: "#333",
                                  borderBottom: "1px solid #f0f0f0",
                                  paddingBottom: "4px",
                                  lineHeight: "1.3"
                                }}>
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 style={{
                                  fontSize: "1.15em",
                                  fontWeight: "600",
                                  margin: "16px 0 8px 0",
                                  color: "#333",
                                  lineHeight: "1.3"
                                }}>
                                  {children}
                                </h3>
                              ),
                              h4: ({ children }) => (
                                <h4 style={{
                                  fontSize: "1.05em",
                                  fontWeight: "600",
                                  margin: "14px 0 6px 0",
                                  color: "#333",
                                  lineHeight: "1.3"
                                }}>
                                  {children}
                                </h4>
                              ),
                              
                              // Texto con formato
                              strong: ({ children }) => (
                                <strong style={{
                                  fontWeight: "600",
                                  color: "#333"
                                }}>
                                  {children}
                                </strong>
                              ),
                              em: ({ children }) => (
                                <em style={{
                                    fontStyle: "italic",
                                  color: "#555"
                                }}>
                                  {children}
                                </em>
                              ),
                              del: ({ children }) => (
                                <del style={{
                                  textDecoration: "line-through",
                                  color: "#888"
                                }}>
                                  {children}
                                </del>
                              ),
                              
                              // Listas
                              ul: ({ children }) => (
                                <ul style={{
                                  margin: "12px 0",
                                  paddingLeft: "24px",
                                  fontSize: "15px"
                                }}>
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol style={{
                                  margin: "12px 0",
                                  paddingLeft: "24px",
                                  fontSize: "15px"
                                }}>
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li style={{
                                  margin: "6px 0",
                                  lineHeight: "1.6",
                                  color: "#333"
                                }}>
                                  {children}
                                </li>
                              ),
                              
                              // Enlaces
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#0066cc",
                                    textDecoration: "none",
                                    borderBottom: "1px solid transparent",
                                    transition: "all 0.2s ease"
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.color = "#004499"
                                    e.target.style.borderBottomColor = "#004499"
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.color = "#0066cc"
                                    e.target.style.borderBottomColor = "transparent"
                                  }}
                                >
                                  {children}
                                </a>
                              ),
                              
                              // Código inline
                              code: ({ inline, className, children, ...props }) => {
                                if (inline) {
                                  return (
                                    <code
                                      style={{
                                        background: "#f4f4f4",
                                        border: "1px solid #e1e1e1",
                                        borderRadius: "4px",
                                        padding: "2px 6px",
                                        fontFamily: "'Courier New', Consolas, monospace",
                                        fontSize: "0.9em",
                                        color: "#d63384"
                                      }}
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  )
                                }
                                return (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                )
                              },
                              
                              // Bloques de código
                              pre: ({ children }) => (
                                <pre style={{
                                  background: "#f8f8f8",
                                  border: "1px solid #e1e1e1",
                                  borderRadius: "8px",
                                  padding: "16px",
                                  overflowX: "auto",
                                  margin: "12px 0",
                                  fontFamily: "'Courier New', Consolas, monospace",
                                  fontSize: "14px",
                                  lineHeight: "1.4"
                                }}>
                                  {children}
                                </pre>
                              ),
                              
                              // Blockquotes
                              blockquote: ({ children }) => (
                                <blockquote style={{
                                  borderLeft: "4px solid #ddd",
                                  margin: "16px 0",
                                  padding: "8px 16px",
                                  background: "#fafafa",
                                  fontStyle: "italic",
                                  color: "#555"
                                }}>
                                  {children}
                                </blockquote>
                              ),
                              
                              // Tablas
                              table: ({ children }) => (
                                <div style={{ overflowX: "auto", margin: "16px 0" }}>
                                  <table style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    border: "1px solid #ddd",
                                    borderRadius: "8px",
                                    overflow: "hidden"
                                  }}>
                                    {children}
                                  </table>
                                </div>
                              ),
                              th: ({ children }) => (
                                <th style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  borderBottom: "1px solid #ddd",
                                  background: "#f5f5f5",
                                  fontWeight: "600",
                                  color: "#333"
                                }}>
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  borderBottom: "1px solid #ddd"
                                }}>
                                  {children}
                                </td>
                              ),
                              
                              // Líneas horizontales
                              hr: () => (
                                <hr style={{
                                  border: "none",
                                  borderTop: "2px solid #eee",
                                  margin: "24px 0"
                                }} />
                              ),
                              
                              // Imágenes
                              img: ({ src, alt }) => (
                                <img 
                                  src={src} 
                                  alt={alt}
                                  style={{
                                    maxWidth: "100%",
                                    height: "auto",
                                    borderRadius: "8px",
                                    margin: "12px 0",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                                  }}
                                />
                              )
                            }}
                          >
                            {msg.text || ""}
                          </ReactMarkdown>
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
                        <p style={{ whiteSpace: "pre-line" }}>{msg.text}</p>
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
            <form onSubmit={handleSubmit}>
              <div className="ds-input-wrapper">
                <input
                  type="text"
                  placeholder="¿Cómo puede ayudar Deitana IA?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="ds-chat-input"
                />
                <button type="submit" className="ds-send-button" disabled={!message.trim()}>
                  <Send size={20} />
                </button>
              </div>
            </form>
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
                    <span>{getUserInitials()}</span>
                  </div>
                  <div className="ds-user-info-large">
                    <div className="ds-user-name-large">{user?.displayName || "Usuario"}</div>
                    <div className="ds-user-email-large">{user?.email || ""}</div>
                  </div>
                  <button className="ds-admin-btn" onClick={() => setModalView("admin")}>
                    Administrar
                  </button>
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
                        <span>{getUserInitials()}</span>
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

            {modalView === "admin" && (
              <div className="section-content">
                <div className="ds-admin-options">
                  <h3>Administrar cuenta</h3>
                  <button className="ds-admin-option-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Cambiar Nombre</span>
                  </button>
                  <button className="ds-admin-option-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <circle cx="12" cy="16" r="1" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Cambiar contraseña</span>
                  </button>
                  <button className="ds-admin-option-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <span>Cambiar email</span>
                  </button>
                  <button className="ds-admin-option-btn ds-admin-danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                    <span>Eliminar cuenta</span>
                  </button>
                </div>
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
                  setModalView("account")
                }}
              >
                ×
              </button>
            </div>

            <div className="ds-user-modal-content">
              <div className="ds-user-modal-sidebar">
                <button
                  className={`ds-modal-nav-item ${modalView === "account" ? "active" : ""}`}
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
                {(modalView === "account" || !modalView) && (
                  <>
                <div className="ds-user-profile-card">
                  <div className="ds-user-avatar-large">
                        <span>{getUserInitials()}</span>
                  </div>
                  <div className="ds-user-info-large">
                        <div className="ds-user-name-large">{user?.displayName || "Usuario"}</div>
                        <div className="ds-user-email-large">{user?.email || ""}</div>
                  </div>
                      <button className="ds-admin-btn" onClick={() => setModalView("admin")}>
                        Administrar
                      </button>
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

                {modalView === "admin" && (
                  <div className="ds-admin-options">
                    <h3>Administrar cuenta</h3>
                    <button className="ds-admin-option-btn">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>Cambiar Nombre</span>
                    </button>
                    <button className="ds-admin-option-btn">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <circle cx="12" cy="16" r="1" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>Cambiar contraseña</span>
                    </button>
                    <button className="ds-admin-option-btn">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <span>Cambiar email</span>
                    </button>
                    <button className="ds-admin-option-btn ds-admin-danger">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6" />
                        <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                      <span>Eliminar cuenta</span>
                    </button>
              </div>
                )}

                {modalView === "appearance" && (
                  <div className="ds-config-section">
                    {/* Sección de imagen de perfil */}
                    <div className="ds-config-item">
                      <label className="ds-config-label">Imagen</label>
                      <div className="ds-profile-image-section">
                        <div className="ds-user-avatar-config">
                          <span>{getUserInitials()}</span>
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

                    {/* Sección de nombre */}
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

                    {/* Botón de guardar */}
                    <div className="ds-config-actions">
                      <button className="ds-save-config-btn">Guardar cambios</button>
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










