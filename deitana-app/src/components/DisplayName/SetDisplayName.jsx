import React, { useState } from 'react'
import { updatePassword, updateProfile } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../global.css'

const SetDisplayName = () => {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { user, completeSetup } = useAuth()
  const navigate = useNavigate()

  const handleContinue = async () => {
    if (!user) {
      setError('No hay usuario autenticado')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Actualizar el displayName del usuario
      await updateProfile(user, {
        displayName: name.trim()
      })

      // Actualizar la contraseña del usuario
      await updatePassword(user, password)

      // Marcar que el usuario completó la configuración
      completeSetup()

      // Redirigir al home
      navigate('/home', { replace: true })
    } catch (err) {
      console.error('Error al configurar usuario:', err)
      setError('Error al guardar la configuración. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="logo-container">
          <img src="/logo-login.png" alt="Logo" className="logo" />
        </div>

        <div className="divider"></div>

        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label htmlFor="name">Nombre</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Escribe tu nombre"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Escribe una contraseña"
              required
              disabled={isLoading}
            />
          </div>

          {error && (
            <p className="error-message" style={{ color: "red", fontSize: "14px", marginTop: "8px" }}>
              {error}
            </p>
          )}

          <button
            type="button"
            className="login-button"
            onClick={handleContinue}
            disabled={!name.trim() || !password.trim() || isLoading}
            style={{
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Configurando..." : "Continuar"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SetDisplayName