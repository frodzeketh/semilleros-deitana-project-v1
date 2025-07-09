"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { auth } from "../components/Authenticator/firebase"

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      // Verificar si el usuario necesita configuración inicial
      if (user) {
        // Si no tiene displayName o es muy corto, necesita configuración
        const needsConfig = !user.displayName || user.displayName.trim().length < 2
        setNeedsSetup(needsConfig)
      } else {
        setNeedsSetup(false)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const logout = async () => {
    try {
      await signOut(auth)
      setUser(null)
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }
  }

  // Función para marcar que el usuario completó la configuración
  const completeSetup = () => {
    setNeedsSetup(false)
  }

  const value = {
    user,
    loading,
    needsSetup,
    logout,
    completeSetup,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}