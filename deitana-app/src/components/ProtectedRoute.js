"use client"
import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()

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
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
