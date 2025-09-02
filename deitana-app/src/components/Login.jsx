"use client"

import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "./Authenticator/firebase"
import { useAuth } from "../context/AuthContext"
import "../global.css"

const Login = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { user, loading, needsSetup } = useAuth()
  const [searchParams] = useSearchParams()

  // Si el usuario ya está autenticado, redirigir según su estado
  useEffect(() => {
    if (!loading && user && user.uid) {
      // Obtener la URL de redirección si existe
      const redirectUrl = searchParams.get('redirect')
      
      if (needsSetup) {
        // Si necesita configuración, ir a configuser pero preservar la redirección
        if (redirectUrl) {
          navigate(`/configuser?redirect=${encodeURIComponent(redirectUrl)}`, { replace: true })
        } else {
          navigate("/configuser", { replace: true })
        }
      } else {
        // Si no necesita configuración, ir a la URL de redirección o al home
        if (redirectUrl) {
          navigate(redirectUrl, { replace: true })
        } else {
          navigate("/home", { replace: true })
        }
      }
    }
  }, [user, loading, needsSetup, navigate, searchParams])

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Cargando autenticación...</p>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      await signInWithEmailAndPassword(auth, email, password)
      // La redirección se manejará automáticamente por el useEffect
    } catch (err) {
      setError("Correo o contraseña incorrectos.")
      console.error(err)
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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={isLoading}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="error-message" style={{ color: "red", fontSize: "14px", marginTop: "8px" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
            style={{
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Iniciando sesión..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login