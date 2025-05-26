import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "../src/components/Home"
import Login from "../src/components/Login"
import ProtectedRoute from "../src/components/ProtectedRoute"
import { AuthProvider } from "../src/context/AuthContext"

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  )
}