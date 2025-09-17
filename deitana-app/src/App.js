import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Home from "../src/components/Home"
import Login from "../src/components/Login"
import SetDisplayName from "../src/components/DisplayName/SetDisplayName"
import ProtectedRoute from "../src/components/ProtectedRoute"
import SetupRoute from "../src/components/SetupRoute"
import SemillasEnCamara from "../src/components/SemillasEnCamara"
import { AuthProvider } from "../src/context/AuthContext"

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/configuser" 
            element={
              <ProtectedRoute>
                <SetDisplayName />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/home"
            element={
              <SetupRoute>
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              </SetupRoute>
            }
          />
          <Route
            path="/semillasencamara"
            element={
              <SetupRoute>
                <ProtectedRoute>
                  <SemillasEnCamara />
                </ProtectedRoute>
              </SetupRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}