import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const SetupRoute = ({ children }) => {
  const { user, loading, needsSetup } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Si no hay usuario, redirigir al login
        navigate('/login', { replace: true })
      } else if (needsSetup) {
        // Si el usuario necesita configuración, redirigir a configuser
        navigate('/configuser', { replace: true })
      }
    }
  }, [user, loading, needsSetup, navigate])

  // Mostrar loading mientras se verifica
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Cargando...</p>
      </div>
    )
  }

  // Si no hay usuario, no mostrar nada (se redirigirá)
  if (!user) {
    return null
  }

  // Si necesita configuración, no mostrar nada (se redirigirá)
  if (needsSetup) {
    return null
  }

  // Si todo está bien, mostrar el contenido
  return children
}

export default SetupRoute 