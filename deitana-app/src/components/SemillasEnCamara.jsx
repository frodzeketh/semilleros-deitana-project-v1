import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Users, Hash, Scale } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../components/Authenticator/firebase';

const API_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://semilleros-deitana-project-v1-production.up.railway.app";

// Los datos ahora se cargan desde la VPS

const SemillasEnCamara = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estados para datos de semillas
  const [seedsData, setSeedsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para el sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [modalView, setModalView] = useState("main");
  
  // Estados para el historial
  const [activeSection, setActiveSection] = useState("historial");
  const [historialExpanded, setHistorialExpanded] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);
  const [historialItemsToShow, setHistorialItemsToShow] = useState(10);
  const [timeUpdate, setTimeUpdate] = useState(0);
  const HISTORIAL_INCREMENT = 10;

  const handleTakePhoto = () => {
    console.log('Tomando foto...');
    alert('Función de tomar foto en desarrollo');
  };

  const handleUploadImage = () => {
    console.log('Subiendo imagen...');
    alert('Función de subir imagen en desarrollo');
  };

  const handleGoToChat = () => {
    navigate('/home');
  };

  // Función para cargar datos de semillas desde la VPS
  const loadSeedsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No hay usuario autenticado');
      }

      console.log('🌱 [FRONTEND] Cargando datos de semillas desde VPS...');
      
      const response = await fetch(`${API_URL}/api/chat/semillas/stock`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('🌱 [FRONTEND] Datos cargados exitosamente:', data.data.length, 'registros');
        console.log('🌱 [FRONTEND] Datos recibidos:', data.data);
        setSeedsData(data.data);
      } else {
        throw new Error(data.error || 'Error al cargar los datos');
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error al cargar datos de semillas:', error);
      setError(error.message);
      // En caso de error, usar datos de ejemplo como fallback
      setSeedsData([
        {
          id: 1,
          articulo: "BROC. ARES",
          cliente: "Cliente VPS",
          lote: "LOTE-001",
          cantidad: 150,
        },
        {
          id: 2,
          articulo: "TOM. CHERRY",
          cliente: "Cliente VPS", 
          lote: "LOTE-002",
          cantidad: 200,
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Función para filtrar semillas
  const filteredSeeds = seedsData.filter(
    (seed) => {
      const id = String(seed.id || '');
      const articulo = seed.articulo || '';
      const cliente = seed.cliente || '';
      const origen = seed.origen || '';
      const envase = seed.envase || '';
      
      return (
        id.includes(searchTerm) ||
        articulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        origen.toLowerCase().includes(searchTerm.toLowerCase()) ||
        envase.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  );

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

  // Cargar datos de semillas al montar el componente
  useEffect(() => {
    loadSeedsData();
  }, []);

  // Cargar el historial de chats al montar el componente
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch(`${API_URL}/conversations`, {
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
                <button className="ds-nav-item" onClick={() => setSearchModalOpen(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
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
                  onClick={() => {
                    navigate('/home');
                    if (isMobile) {
                      setMobileSidebarOpen(false);
                    }
                  }}
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
                  className="ds-nav-item active"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>Semillar en Cámara</span>
                </button>

                <button
                  className={`ds-nav-item${historialExpanded ? " active" : ""}`}
                  onClick={() => {
                    if (activeSection !== "historial") {
                      setActiveSection("historial");
                      setHistorialExpanded(true);
                      setHistorialItemsToShow(10); // Reiniciar paginación
                    } else {
                      setHistorialExpanded(!historialExpanded);
                      if (!historialExpanded) {
                        setHistorialItemsToShow(10); // Reiniciar paginación al abrir
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
                        return (
                          <>
                            {Object.entries(groups).map(([dateGroup, chats]) => (
                              <div key={dateGroup} className="ds-date-group">
                                <div className="ds-date-header">{dateGroup}</div>
                                {chats.map((chat) => (
                                  <button
                                    key={`${chat.id}-${timeUpdate}`}
                                    onClick={() => navigate(`/home?chat=${chat.id}`)}
                                    className="ds-historial-item"
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
                                Mostrar más
                              </button>
                            )}
                          </>
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
                  <button className="ds-user-circle" onClick={handleLogout}>
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
                <button className="ds-nav-item" onClick={() => setSearchModalOpen(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
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
                  className="ds-nav-item active"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>

                <button
                  className={`ds-nav-item ${activeSection === "historial" ? "active" : ""}`}
                  onClick={() => {
                    if (activeSection !== "historial") {
                      setActiveSection("historial");
                      setHistorialExpanded(true);
                      setHistorialItemsToShow(10); // Reiniciar paginación
                    } else {
                      setHistorialExpanded(!historialExpanded);
                      if (!historialExpanded) {
                        setHistorialItemsToShow(10); // Reiniciar paginación al abrir
                      }
                    }
                    if (!sidebarOpen) toggleSidebar();
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M12 7v5l4 2" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Footer colapsado */}
            <div className="ds-sidebar-footer">
              <div className="ds-user-section">
                <div className="ds-user-info">
                  <button className="ds-user-circle" onClick={handleLogout}>
                    {getUserAvatar()}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="ds-main-content">
        <div className="ds-chat-header">
          {(isMobile || (!isMobile && !sidebarOpen)) && (
            <button className="ds-mobile-menu-button" onClick={toggleSidebar}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="24" height="24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
              </svg>
            </button>
          )}
          <div className="ds-chat-header-title">
            <h1>Semillas en Cámara</h1>
          </div>
        </div>
        
        <div className="seed-search-container">

          {/* Search Bar */}
          <div className="seed-search-bar">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Buscar por ID remesa, artículo, cliente, origen o envase..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Cargando datos de semillas desde la VPS...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="error-state">
              <div className="error-icon">⚠️</div>
              <h3>Error al cargar datos</h3>
              <p>{error}</p>
              <button onClick={loadSeedsData} className="retry-button">
                Reintentar
              </button>
            </div>
          )}

          {/* Results Count */}
          {!loading && !error && (
            <div className="results-count">
              <p>
                {filteredSeeds.length} resultado{filteredSeeds.length !== 1 ? "s" : ""} encontrado
                {filteredSeeds.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          {/* Results Table */}
          {!loading && !error && filteredSeeds.length > 0 ? (
            <div className="results-table-container">
                <table className="results-table">
                  <thead>
                    <tr className="table-header">
                      <th>
                        <div className="header-cell">
                          <Hash className="header-icon" />
                          ID Remesa
                        </div>
                      </th>
                      <th>
                        <div className="header-cell">
                          <Package className="header-icon" />
                          Artículo
                        </div>
                      </th>
                      <th>
                        <div className="header-cell">
                          <Users className="header-icon" />
                          Cliente
                        </div>
                      </th>
                      <th>
                        <div className="header-cell">
                          <Hash className="header-icon" />
                          Origen
                        </div>
                      </th>
                      <th>
                        <div className="header-cell">
                          <Package className="header-icon" />
                          Envase
                        </div>
                      </th>
                      <th>
                        <div className="header-cell right">
                          <Scale className="header-icon" />
                          Stock
                        </div>
                      </th>
                    </tr>
                  </thead>
                <tbody>
                  {filteredSeeds.map((seed) => (
                    <tr key={seed.id} className="table-row">
                      <td className="table-cell">
                        <span className="badge">{seed.id || 'N/A'}</span>
                      </td>
                      <td className="table-cell article">{seed.articulo || 'N/A'}</td>
                      <td className="table-cell client">{seed.cliente || 'N/A'}</td>
                      <td className="table-cell">
                        <span className="badge">{seed.origen || 'N/A'}</span>
                      </td>
                      <td className="table-cell">{seed.envase || 'N/A'}</td>
                      <td className="table-cell quantity">{seed.stock || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading && !error ? (
            <div className="no-results">
              <div className="no-results-icon">
                <svg className="search-icon-large" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <h3>No se encontraron resultados</h3>
              <p>Intenta con otros términos de búsqueda</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SemillasEnCamara;
