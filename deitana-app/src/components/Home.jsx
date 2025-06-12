"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, PanelLeftClose, Send, ChevronDown, Search, Settings, LogOut, Edit3, Clock } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useAuth } from "../context/AuthContext"
import { auth } from "../components/Authenticator/firebase"

const API_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://semilleros-deitana-project-v1-production.up.railway.app"

const Home = () => {
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

  // Obtener la función de logout del contexto de autenticación
  const { logout } = useAuth()

  // Datos de ejemplo para el historial de chats
  const [chatHistory, setChatHistory] = useState([])

  // Cargar el historial de chats al montar el componente
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch(`${API_URL}/conversations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Error al cargar el historial: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          setChatHistory(data.data);
        } else {
          throw new Error(data.error || 'Error al cargar el historial de chats');
        }
      } catch (error) {
        console.error('Error al cargar el historial de chats:', error);
      }
    };

    loadChatHistory();
  }, []);

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

  const handleNewChat = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      // Crear nueva conversación
      const response = await fetch(`${API_URL}/chat/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: 'NUEVA_CONEXION' })
      });

      if (!response.ok) {
        throw new Error('Error al crear nueva conversación');
      }

      const data = await response.json();
      if (data.success) {
        setCurrentConversationId(data.conversationId);
        setChatMessages([]);
        // Recargar el historial de chats
        const historyResponse = await fetch(`${API_URL}/conversations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!historyResponse.ok) {
          throw new Error('Error al cargar el historial');
        }

        const historyData = await historyResponse.json();
        if (historyData.success) {
          setChatHistory(historyData.data);
        }
      }
    } catch (error) {
      console.error('Error al crear nuevo chat:', error);
      // Mostrar mensaje de error al usuario
      setChatMessages(prev => [...prev, {
        id: Date.now(),
        text: "Hubo un error al crear el chat. Por favor, intenta de nuevo.",
        sender: "bot",
        isError: true
      }]);
    }
  };

  // Modificar la función handleSubmit para usar la conversación actual
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    console.log('=== INICIO ENVÍO DE MENSAJE ===');
    console.log('Mensaje a enviar:', message);
    console.log('Conversation ID actual:', currentConversationId);

    const userMessage = {
      id: Date.now(),
      text: message,
      sender: "user",
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsTyping(true);

    // Crear mensaje del bot con estado de carga
    const botMessage = {
      id: Date.now() + 1,
      text: "",
      sender: "bot",
      isStreaming: true,
    };
    setChatMessages((prev) => {
      console.log('Creando nuevo mensaje del bot:', botMessage);
      return [...prev, botMessage];
    });

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No hay usuario autenticado');
      }

      console.log('Token obtenido, realizando petición al servidor...');

      let url = `${API_URL}/chat`;
      let body = { message };

      // Si no hay conversación actual, crear una nueva
      if (!currentConversationId) {
        console.log('Creando nueva conversación...');
        const newConversationResponse = await fetch(`${API_URL}/chat/new`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message })
        });

        if (!newConversationResponse.ok) {
          throw new Error('Error al crear nueva conversación');
        }

        const newConversationData = await newConversationResponse.json();
        if (!newConversationData.success) {
          throw new Error(newConversationData.error || 'Error al crear nueva conversación');
        }

        setCurrentConversationId(newConversationData.data.conversationId);
        body.conversationId = newConversationData.data.conversationId;
      } else {
        body.conversationId = currentConversationId;
      }

      console.log('URL:', url);
      console.log('Headers:', {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Conversation-Id": currentConversationId || 'new'
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Conversation-Id": currentConversationId || 'new'
        },
        body: JSON.stringify(body)
      });

      console.log('Respuesta recibida:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error en la respuesta:', errorData);
        throw new Error(errorData.error || 'Error en el procesamiento del mensaje');
      }

      const data = await response.json();
      console.log('Datos recibidos:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Error en el procesamiento del mensaje');
      }

      // Actualizar el mensaje del bot con la respuesta
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessage.id
            ? {
                ...msg,
                text: data.data.message,
                isStreaming: false,
              }
            : msg
        )
      );
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      // Actualizar el mensaje del bot con el error
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessage.id
            ? {
                ...msg,
                text: "Hubo un error al conectarse con el servidor.",
                isStreaming: false,
                isError: true,
              }
            : msg
        )
      );
    } finally {
      setIsTyping(false);
      console.log('=== FIN ENVÍO DE MENSAJE ===');
    }
  };

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

  // Añadir estilos CSS para el indicador de escritura en línea
  const [styleAdded, setStyleAdded] = useState(false)

  useEffect(() => {
    if (!styleAdded) {
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

      /* Estilos mejorados para Markdown */
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

      /* Estilos para enlaces */
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
      setStyleAdded(true)

      return () => {
        document.head.removeChild(style)
      }
    }
  }, [styleAdded])

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
                <img src="/logo-crop.png" alt="Logo" className="logo-sidebar-open" />
              </div>
              {isMobile && (
                <button className="ds-mobile-close-button" onClick={() => setMobileSidebarOpen(false)}>
                  ×
                </button>
              )}
            </div>

            {/* Barra de búsqueda */}
            <div className="ds-search-container">
              <div className="ds-search-wrapper">
                <Search size={16} className="ds-search-icon" />
                <input type="text" placeholder="Buscar chats" className="ds-search-input" />
              </div>
            </div>

            <div className="ds-sidebar-content">
              {/* Botón para cerrar sidebar en desktop */}
              {!isMobile && (
                <button className="ds-footer-button" onClick={toggleSidebar}>
                  <PanelLeftClose size={20} />
                  <span className="options-sidebar">Cerrar sidebar</span>
                </button>
              )}

              {/* Botón Nuevo Chat con estilo consistente */}
              <button className="ds-footer-button ds-new-chat-highlight" onClick={handleNewChat}>
                <Edit3 size={20} />
                <span className="options-sidebar">Nuevo chat</span>
              </button>

              {/* Sección Recientes */}
              <div className="ds-chat-section">
                <h3 className="ds-section-title">Recientes</h3>
                {chatHistory.map((chat) => (
                  <button key={chat.id} className="ds-chat-item">
                    <Clock size={16} className="ds-chat-icon" />
                    <div className="ds-chat-info">
                      <span className="ds-chat-title">{chat.title}</span>
                      <span className="ds-chat-timestamp">{chat.timestamp}</span>
                    </div>
                  </button>
                ))}
                <button className="ds-show-more-button">
                  <span>Mostrar más</span>
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            {/* Footer con configuración y logout */}
            <div className="ds-sidebar-footer">
              <button className="ds-footer-button">
                <Settings size={20} />
                <span className="options-sidebar">Configuración y ayuda</span>
              </button>
              <button className="ds-footer-button ds-logout-button" onClick={handleLogout}>
                <LogOut size={20} />
                <span className="options-sidebar">Cerrar sesión</span>
              </button>
            </div>
          </>
        ) : (
          <div className="ds-sidebar-collapsed-content">
            <div className="ds-collapsed-item ds-collapsed-logo" onClick={toggleSidebar}>
              <img src="/logo-crop.png" alt="Logo" className="ds-collapsed-logo-img" />
            </div>
            <div className="ds-collapsed-item" onClick={toggleSidebar}>
              <Edit3 size={25} />
            </div>
            <div className="ds-collapsed-item">
              <MessageSquare size={25} />
            </div>
            <div className="ds-collapsed-spacer"></div>
            <div className="ds-collapsed-item ds-collapsed-user">
              <div className="ds-user-circle">
                <span>F</span>
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          )}
          <h1>Nuevo chat</h1>
          {isMobile && (
            <button className="ds-mobile-new-chat-button" onClick={handleNewChat}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </button>
          )}
        </div>

        <div className="ds-chat-layout">
          {isChatEmpty ? (
            <div className="ds-initial-view">
              <div className="ds-welcome-message">
                <div className="ds-welcome-logo">
                  <img src="/logo-crop.png" alt="Logo" />
                </div>
                <h2>Hola, soy Deitana IA.</h2>
                <p>¿En qué puedo ayudarte hoy?</p>
              </div>
            </div>
          ) : (
            <div className="ds-chat-messages-container" ref={chatContainerRef}>
              <div className="ds-chat-messages">
                <div className="ds-message ds-bot-message">
                  <div className="ds-message-avatar">
                    <img src="/logo-crop.png" alt="Logo" className="ds-avatar-image" />
                  </div>
                  <div className="ds-message-content">
                    <h2>Hola, soy Deitana IA.</h2>
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
                        <img src="/logo-crop.png" alt="Logo" className="ds-avatar-image" />
                      </div>
                    )}
                    <div className="ds-message-content">
                      {msg.sender === "bot" ? (
                        <>
                          {console.log('Renderizando mensaje del bot:', msg)}
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => {
                                console.log('Renderizando párrafo con children:', children)
                                return (
                                  <p
                                    style={{
                                      whiteSpace: "pre-line",
                                      color: "#333",
                                      fontSize: "15px",
                                      lineHeight: "1.6",
                                      marginBottom: "12px",
                                    }}
                                  >
                                    {children}
                                  </p>
                                )
                              },
                              strong: ({ children }) => (
                                <strong
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "15px",
                                    color: "#333",
                                    display: "inline",
                                    marginRight: "4px",
                                  }}
                                >
                                  {children}
                                </strong>
                              ),
                              em: ({ children }) => (
                                <em
                                  style={{
                                    fontStyle: "italic",
                                    color: "#333",
                                    fontSize: "15px",
                                  }}
                                >
                                  {children}
                                </em>
                              ),
                              ul: ({ children }) => (
                                <ul
                                  style={{
                                    margin: "8px 0",
                                    paddingLeft: "20px",
                                    color: "#333",
                                    fontSize: "15px",
                                  }}
                                >
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol
                                  style={{
                                    margin: "8px 0",
                                    paddingLeft: "20px",
                                    color: "#333",
                                    fontSize: "15px",
                                  }}
                                >
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li
                                  style={{
                                    margin: "5px 0",
                                    color: "#333",
                                    fontSize: "15px",
                                  }}
                                >
                                  {children}
                                </li>
                              ),
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#2964aa",
                                    textDecoration: "none",
                                    fontWeight: 500,
                                    borderBottom: "1px solid #2964aa",
                                    paddingBottom: "1px",
                                    transition: "all 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.color = "#1a4b8c"
                                    e.target.style.borderBottomColor = "#1a4b8c"
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.color = "#2964aa"
                                    e.target.style.borderBottomColor = "#2964aa"
                                  }}
                                >
                                  {children}
                                </a>
                              ),
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
                        </>
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
                  placeholder="Mensaje Deitana IA"
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
    </div>
  )
}

export default Home
