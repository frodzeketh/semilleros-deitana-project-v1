"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, PanelLeftClose, Send, ChevronDown } from "lucide-react"
import ReactMarkdown from 'react-markdown'

const API_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://semilleros-deitana-project-v1.onrender.com"

const Home = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [message, setMessage] = useState("")
  const [chatMessages, setChatMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const mainContentRef = useRef(null)

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  // Modificar la función handleSubmit para soportar streaming de texto
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return

    // Generar un ID de sesión si no existe
    if (!localStorage.getItem("sessionId")) {
      localStorage.setItem("sessionId", `session-${Date.now()}`)
    }
    const sessionId = localStorage.getItem("sessionId")

    const userMessage = {
      id: Date.now(),
      text: message,
      sender: "user",
    }

    setChatMessages((prev) => [...prev, userMessage])
    setMessage("")
    setIsTyping(true)

    // Crear un ID único para el mensaje del bot
    const botMessageId = Date.now() + 1

    // Añadir un mensaje vacío del bot que se irá llenando
    setChatMessages((prev) => [
      ...prev,
      {
        id: botMessageId,
        text: "",
        sender: "bot",
        isStreaming: true,
      },
    ])

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Session-Id": sessionId,
        },
        body: JSON.stringify({ message }),
      })

      const data = await response.json()

      // Simular el efecto de streaming de texto
      const fullText = data.response || "Hubo un problema al obtener respuesta."
      let displayedText = ""

      // Determinar la velocidad de escritura basada en la longitud del texto
      const chunkSize = Math.max(1, Math.floor(fullText.length / 100))
      const delay = fullText.length > 500 ? 10 : 20 // Más rápido para textos largos

      for (let i = 0; i < fullText.length; i += chunkSize) {
        const nextChunk = fullText.slice(i, i + chunkSize)
        displayedText += nextChunk

        // Actualizar el mensaje del bot con el texto acumulado
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, text: displayedText, isStreaming: i + chunkSize < fullText.length }
              : msg,
          ),
        )

        // Esperar un poco antes de mostrar el siguiente fragmento
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    } catch (error) {
      console.error("Error al conectar con el backend:", error)
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, text: "Hubo un error al conectarse con el servidor.", isStreaming: false }
            : msg,
        ),
      )
    } finally {
      setIsTyping(false)
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
      <div className={`ds-sidebar ${sidebarOpen ? "ds-sidebar-expanded" : "ds-sidebar-collapsed"}`}>
        {sidebarOpen ? (
          <>
            <div className="ds-sidebar-header">
              <div className="ds-logo-sidebar-container" onClick={toggleSidebar}>
                <img src="/logo-crop.png" alt="Logo" className="logo-sidebar-open" />
              </div>
            </div>
            <div className="ds-sidebar-content">
              <button className="ds-video-button" onClick={toggleSidebar}>
                <PanelLeftClose size={25} />
                <span className="options-sidebar">Close</span>
              </button>
              <button className="ds-new-chat-button">
                <MessageSquare size={25} />
                <span className="options-sidebar">New chat</span>
              </button>
            </div>
            <div className="ds-sidebar-footer"></div>
          </>
        ) : (
          <div className="ds-sidebar-collapsed-content">
            <div className="ds-collapsed-item ds-collapsed-logo" onClick={toggleSidebar}>
              <img src="/logo-crop.png" alt="Logo" className="ds-collapsed-logo-img" />
            </div>
            <div className="ds-collapsed-item" onClick={toggleSidebar}>
              <PanelLeftClose size={25} />
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
        <div className="ds-chat-title">
          <h1>New chat</h1>
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
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p style={{ 
                                whiteSpace: "pre-line", 
                                color: '#333',
                                fontSize: '15px',
                                lineHeight: '1.6',
                                marginBottom: '12px'
                              }}>{children}</p>,
                              strong: ({ children }) => <strong style={{ 
                                fontWeight: 600, 
                                fontSize: '15px', 
                                color: '#333',
                                display: 'inline',
                                marginRight: '4px'
                              }}>{children}</strong>,
                              em: ({ children }) => <em style={{ 
                                fontStyle: "italic", 
                                color: '#333',
                                fontSize: '15px'
                              }}>{children}</em>,
                              ul: ({ children }) => <ul style={{ 
                                margin: "8px 0", 
                                paddingLeft: "20px",
                                color: '#333',
                                fontSize: '15px'
                              }}>{children}</ul>,
                              ol: ({ children }) => <ol style={{ 
                                margin: "8px 0", 
                                paddingLeft: "20px",
                                color: '#333',
                                fontSize: '15px'
                              }}>{children}</ol>,
                              li: ({ children }) => <li style={{ 
                                margin: "5px 0",
                                color: '#333',
                                fontSize: '15px'
                              }}>{children}</li>
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                          {msg.isStreaming && (
                            <span className="ds-typing-indicator-inline">
                              <span></span>
                              <span></span>
                              <span></span>
                            </span>
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