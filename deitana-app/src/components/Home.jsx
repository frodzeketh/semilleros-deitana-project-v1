"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, Video, Send, ChevronDown } from "lucide-react"
import "../global.css"

// CAMBIA esta URL según si estás en local o en producción
const API_URL = "http://localhost:3001"
// const API_URL = "https://semilleros-deitana-project-v1.onrender.com"

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return

    const userMessage = {
      id: Date.now(),
      text: message,
      sender: "user",
    }

    setChatMessages((prev) => [...prev, userMessage])
    setMessage("")
    setIsTyping(true)

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      })

      const data = await response.json()

      const botMessage = {
        id: Date.now() + 1,
        text: data.response || "Hubo un problema al obtener respuesta.",
        sender: "bot",
      }

      setChatMessages((prev) => [...prev, botMessage])
    } catch (error) {
      console.error("Error al conectar con el backend:", error)
      const errorMessage = {
        id: Date.now() + 1,
        text: "Hubo un error al conectarse con el servidor.",
        sender: "bot",
      }
      setChatMessages((prev) => [...prev, errorMessage])
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
      const isScrolledUp =
        chatContainer.scrollTop <
        chatContainer.scrollHeight - chatContainer.clientHeight - 20
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
                <Video size={25} />
                <span className="options-sidebar">Toggle Sidebar</span>
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
              <Video size={25} />
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
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="ds-message ds-bot-message">
                    <div className="ds-message-avatar">
                      <img src="/logo-crop.png" alt="Logo" className="ds-avatar-image" />
                    </div>
                    <div className="ds-typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}

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
