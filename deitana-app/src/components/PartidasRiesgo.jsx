import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Package, User, Calendar, TrendingDown, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../components/Authenticator/firebase';

const API_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://semilleros-deitana-project-v1-production.up.railway.app";

// Datos de ejemplo para partidas de riesgo
const riskBatchesData = [
  {
    id: "PT-2024-001",
    cliente: "Agrícola San José",
    articulo: "Tomate Cherry",
    cantidadSolicitada: 500,
    cantidadInjertada: 320,
    fechaSiembra: "2024-01-15",
    fechaEntrega: "2024-03-20",
    riskLevel: "alto",
  },
  {
    id: "PT-2024-002",
    cliente: "Huertos del Valle",
    articulo: "Pimiento Rojo",
    cantidadSolicitada: 300,
    cantidadInjertada: 180,
    fechaSiembra: "2024-01-20",
    fechaEntrega: "2024-03-25",
    riskLevel: "crítico",
  },
  {
    id: "PT-2024-003",
    cliente: "Cultivos Modernos",
    articulo: "Lechuga Romana",
    cantidadSolicitada: 450,
    cantidadInjertada: 280,
    fechaSiembra: "2024-01-10",
    fechaEntrega: "2024-03-15",
    riskLevel: "alto",
  },
  {
    id: "PT-2024-004",
    cliente: "Invernaderos del Norte",
    articulo: "Pepino Holandés",
    cantidadSolicitada: 600,
    cantidadInjertada: 250,
    fechaSiembra: "2024-01-25",
    fechaEntrega: "2024-03-30",
    riskLevel: "crítico",
  },
  {
    id: "PT-2024-005",
    cliente: "Agrícola San José",
    articulo: "Berenjena Larga",
    cantidadSolicitada: 350,
    cantidadInjertada: 200,
    fechaSiembra: "2024-01-18",
    fechaEntrega: "2024-03-22",
    riskLevel: "alto",
  },
];

const PartidasRiesgo = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [partidasData, setPartidasData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Función para obtener datos de partidas de riesgo
  const fetchPartidasData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No hay usuario autenticado');
      }

      console.log('🚨 [FRONTEND] Cargando datos de partidas de riesgo desde VPS...');
      
      const response = await fetch(`${API_URL}/api/chat/partidas/riesgo`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('🚨 [FRONTEND] Datos cargados exitosamente:', data.data.length, 'registros');
        console.log('🚨 [FRONTEND] Datos recibidos:', data.data);
        setPartidasData(data.data);
      } else {
        throw new Error(data.error || 'Error al cargar los datos');
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error al cargar datos de partidas de riesgo:', error);
      setError(error.message);
      // En caso de error, usar datos de ejemplo
      setPartidasData(riskBatchesData);
    } finally {
      setLoading(false);
    }
  };
  
  // Cargar datos al montar el componente
  useEffect(() => {
    fetchPartidasData();
  }, []);
  
  // Estados para el sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // Estados para el historial
  const [activeSection, setActiveSection] = useState("historial");
  const [historialExpanded, setHistorialExpanded] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);
  const [historialItemsToShow, setHistorialItemsToShow] = useState(10);
  const HISTORIAL_INCREMENT = 10;

  // Estados para el modal del usuario
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [modalView, setModalView] = useState("main");

  // Estados para el drag del bottom sheet en móvil
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [startY, setStartY] = useState(0);

  // Detectar si estamos en móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setMobileSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  // Función para obtener las iniciales del usuario
  const getUserInitials = () => {
    if (!user?.displayName) return "U";
    
    const names = user.displayName.split(" ");
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  // Función para obtener la imagen del avatar o las iniciales
  const getUserAvatar = () => {
    if (user?.photoURL) {
      return <img src={user.photoURL} alt="Avatar" className="ds-avatar-image" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />;
    }
    return <span>{getUserInitials()}</span>;
  };

  const handleLogout = async () => {
    try {
      await logout();
      console.log("Sesión cerrada exitosamente");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // Funciones para drag del bottom sheet iOS
  const handleTouchStart = (e) => {
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    if (dragY > 100) {
      setUserMenuOpen(false);
      // Resetear al menú principal cuando se cierra
      setTimeout(() => setModalView("main"), 300);
    }

    setDragY(0);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartY(e.clientY);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const currentY = e.clientY;
    const deltaY = currentY - startY;

    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);

    if (dragY > 100) {
      setUserMenuOpen(false);
      // Resetear al menú principal cuando se cierra
      setTimeout(() => setModalView("main"), 300);
    }

    setDragY(0);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Función para agrupar chats por fecha
  const groupChatsByDate = (chats) => {
    const groups = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    chats.forEach(chat => {
      const chatDate = new Date(chat.createdAt);
      const chatDateOnly = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());
      
      let dateGroup;
      if (chatDateOnly.getTime() === today.getTime()) {
        dateGroup = "Hoy";
      } else if (chatDateOnly.getTime() === yesterday.getTime()) {
        dateGroup = "Ayer";
      } else {
        dateGroup = chatDate.toLocaleDateString('es-ES', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        dateGroup = dateGroup.charAt(0).toUpperCase() + dateGroup.slice(1);
      }
      
      if (!groups[dateGroup]) {
        groups[dateGroup] = [];
      }
      groups[dateGroup].push(chat);
    });

    // Ordenar chats dentro de cada grupo por fecha (más reciente primero)
    Object.keys(groups).forEach(dateGroup => {
      groups[dateGroup].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });

    return groups;
  };

  // Función para obtener chats limitados por paginación
  const getLimitedChatHistory = () => {
    const groupedChats = groupChatsByDate(chatHistory);
    const limitedGroups = {};
    let totalShown = 0;

    for (const [dateGroup, chats] of Object.entries(groupedChats)) {
      if (totalShown >= historialItemsToShow) break;
      
      const remainingSlots = historialItemsToShow - totalShown;
      const chatsToShow = chats.slice(0, remainingSlots);
      
      if (chatsToShow.length > 0) {
        limitedGroups[dateGroup] = chatsToShow;
        totalShown += chatsToShow.length;
      }
    }

    return {
      groups: limitedGroups,
      hasMore: totalShown < chatHistory.length
    };
  };

  // Función para mostrar más elementos del historial
  const handleShowMoreHistory = () => {
    setHistorialItemsToShow(prev => prev + HISTORIAL_INCREMENT);
  };

  // Cargar el historial de chats al montar el componente
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch(`${process.env.NODE_ENV === "development" ? "http://localhost:3001" : "https://semilleros-deitana-project-v1-production.up.railway.app"}/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error al cargar el historial: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          setChatHistory(data.data);
        } else {
          throw new Error(data.error || "Error al cargar el historial de chats");
        }
      } catch (error) {
        console.error("Error al cargar el historial de chats:", error);
      }
    };

    loadChatHistory();
  }, []);

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
                <button className="ds-nav-item">
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

                <button
                  className="ds-nav-item"
                  onClick={() => navigate('/home')}
                >
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

                <button className="ds-nav-item active">
                  <AlertTriangle size={16} />
                  <span>Partidas Riesgo</span>
                </button>

                <button
                  className={`ds-nav-item${historialExpanded ? " active" : ""}`}
                  onClick={() => {
                    if (activeSection !== "historial") {
                      setActiveSection("historial");
                      setHistorialExpanded(true);
                      setHistorialItemsToShow(10);
                    } else {
                      setHistorialExpanded(!historialExpanded);
                      if (!historialExpanded) {
                        setHistorialItemsToShow(10);
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
                        const { groups, hasMore } = getLimitedChatHistory();
                        return Object.keys(groups).length > 0 ? (
                          <>
                            {Object.entries(groups).map(([dateGroup, chats]) => (
                              <div key={dateGroup} className="ds-date-group">
                                <div className="ds-date-header">{dateGroup}</div>
                                {chats.map((chat, index) => (
                                  <button
                                    key={index}
                                    className="ds-historial-item"
                                    onClick={() => {
                                      // Aquí puedes manejar la carga de un chat específico
                                      console.log('Cargar chat:', chat);
                                    }}
                                  >
                                    <span className="ds-historial-title">
                                      {chat.title === "NUEVA_CONEXION" ? "Nueva conversación" : chat.title}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ))}
                            {hasMore && (
                              <button
                                className="ds-show-more-button"
                                onClick={handleShowMoreHistory}
                              >
                                Cargar más...
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="ds-no-historial">
                            <p>No hay historial de conversaciones</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer con usuario */}
            <div className="ds-sidebar-footer">
              <div className="ds-user-section">
                <div className="ds-user-info">
                  <button className="ds-user-circle" onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    if (isMobile) {
                      setMobileSidebarOpen(false);
                    }
                  }}>
                    {getUserAvatar()}
                  </button>
                </div>
              </div>
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
                <button className="ds-nav-item">
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
                  className="ds-nav-item"
                  onClick={() => {
                    navigate('/home');
                    if (!sidebarOpen) toggleSidebar();
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
                  className="ds-nav-item"
                  onClick={() => navigate('/semillasencamara')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>

                <button className="ds-nav-item active">
                  <AlertTriangle size={16} />
                </button>

                <button className="ds-nav-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M12 7v5l4 2" />
                  </svg>
                </button>

                <button className="ds-nav-item" onClick={handleLogout}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16,17 21,12 16,7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Footer colapsado */}
            <div className="ds-sidebar-footer">
              <div className="ds-user-section">
                <div className="ds-user-info">
                  <button className="ds-user-circle" onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    if (isMobile) {
                      setMobileSidebarOpen(false);
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

      {/* Main Content - VACÍO */}
      <div className="ds-main-content">
        {/* Solo el header móvil si es necesario */}
        {(isMobile || (!isMobile && !sidebarOpen)) && (
          <div className="ds-chat-header">
            <button className="ds-mobile-menu-button" onClick={toggleSidebar}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="24" height="24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
              </svg>
            </button>
            <div className="ds-chat-header-title">
              <h1>Partidas de Riesgo</h1>
            </div>
          </div>
        )}

        {/* Contenido de Partidas de Riesgo */}
        <div className="ds-partidas-riesgo-content">
          {/* Header de la página */}
          <div className="ds-partidas-header">
            
            {/* Barra de búsqueda */}
            <div className="ds-partidas-search">
              <div className="ds-search-wrapper">
                <Search className="ds-search-icon" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por ID de partida, cliente..."
                  className="ds-search-input"
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Lista de partidas de riesgo */}
          <div className="ds-partidas-list">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Cargando partidas de riesgo...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <h3>Error al cargar los datos</h3>
                <p>{error}</p>
                <button onClick={fetchPartidasData} className="retry-button">
                  Reintentar
                </button>
              </div>
            ) : partidasData.length === 0 ? (
              <div className="no-results">
                <div className="no-results-icon">
                  <AlertTriangle size={48} />
                </div>
                <h3>No hay partidas de riesgo</h3>
                <p>No se encontraron partidas con alto riesgo de incumplimiento.</p>
              </div>
            ) : (
              partidasData.map((batch) => (
              <div
                key={batch.id}
                className={`ds-partida-card ${batch.riskLevel === "crítico" ? "ds-partida-critica" : "ds-partida-alta"}`}
              >
                <div className="ds-partida-grid">
                  {/* ID Section */}
                  <div className="ds-partida-id">
                    <div className="ds-partida-id-icon">
                      <Package size={16} />
                    </div>
                    <div>
                      <p className="ds-partida-label">ID DE PARTIDA</p>
                      <p className="ds-partida-id-text">{batch.id}</p>
                    </div>
                  </div>

                  {/* Cliente Section */}
                  <div className="ds-partida-cliente">
                    <div className="ds-partida-field-header">
                      <User size={12} />
                      <span>CLIENTE</span>
                    </div>
                    <p className="ds-partida-cliente-text">{batch.cliente}</p>
                  </div>

                  {/* Artículo Section */}
                  <div className="ds-partida-articulo">
                    <div className="ds-partida-field-header">
                      <Package size={12} />
                      <span>ARTICULO</span>
                    </div>
                    <p className="ds-partida-articulo-text">{batch.articulo}</p>
                  </div>

                  {/* Cantidades Section */}
                  <div className="ds-partida-cantidades">
                    <div className="ds-cantidad-item ds-cantidad-solicitada">
                      <p className="ds-cantidad-label">PLANTAS SOLICITADAS</p>
                      <p className="ds-cantidad-value">{batch.cantidadSolicitada}</p>
                    </div>
                    <div className="ds-cantidad-item ds-cantidad-injertada">
                      <p className="ds-cantidad-label">PLANTAS APROXIMADAS</p>
                      <p className="ds-cantidad-value">{batch.cantidadInjertada}</p>
                    </div>
                    <div className="ds-cantidad-item ds-cantidad-deficit">
                      <TrendingDown size={12} />
                      <p className="ds-cantidad-label">INJERTADAS</p>
                      <p className="ds-cantidad-value">{batch.cantidadInjertada}</p>
                    </div>
                    <div className="ds-cantidad-item ds-cantidad-deficit">
                      <TrendingDown size={12} />
                      <p className="ds-cantidad-label">DEFICIT</p>
                      <p className="ds-cantidad-value">{batch.cantidadSolicitada - batch.cantidadInjertada}</p>
                    </div>
                  </div>

                  {/* Fechas Section */}
                  <div className="ds-partida-fechas">
                    <div className="ds-fecha-item">
                      <div className="ds-fecha-header">
                        <Calendar size={12} />
                        <span>SIEMBRA</span>
                      </div>
                      <p className="ds-fecha-value">{batch.fechaSiembra}</p>
                    </div>
                    <div className="ds-fecha-item ds-fecha-entrega">
                      <div className="ds-fecha-header">
                        <Clock size={12} />
                        <span>ENTREGA</span>
                      </div>
                      <p className="ds-fecha-value">{batch.fechaEntrega}</p>
                    </div>
                  </div>

                  {/* Acciones Section */}
                  <div className="ds-partida-acciones">
                    <div className={`ds-risk-badge ${batch.riskLevel === "crítico" ? "ds-risk-critico" : "ds-risk-alto"}`}>
                      <AlertTriangle size={12} />
                      <span>{batch.riskLevel === "crítico" ? "CRÍTICO" : "ALTO"}</span>
                    </div>
                  </div>
                </div>
              </div>
              ))
            )}
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
                <p>Configuración de apariencia próximamente...</p>
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
                  <div>
                    <p>Configuración de apariencia próximamente...</p>
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
    </div>
  );
};

export default PartidasRiesgo;
