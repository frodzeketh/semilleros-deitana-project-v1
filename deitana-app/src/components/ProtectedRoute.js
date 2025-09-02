"use client"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <p>Cargando...</p>
      </div>
    )
  }

  // Verificación estricta de autenticación
  if (!user || !user.uid) {
    // Preservar la URL actual incluyendo query parameters para redirección posterior
    const redirectUrl = location.pathname + location.search
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectUrl)}`} replace />
  }

  return children
}

export default ProtectedRoute
