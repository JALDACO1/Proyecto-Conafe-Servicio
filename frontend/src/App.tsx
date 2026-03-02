/**
 * Componente Principal: App
 * ==========================
 * Punto de entrada de la aplicación
 *
 * Características:
 * - Enrutamiento con React Router
 * - Inicialización de autenticación
 * - Rutas protegidas por rol
 * - Layout responsive
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Componentes de autenticación
import { LoginForm } from './components/auth/LoginForm';
import { ProtectedRoute, AdminRoute, UserRoute } from './components/auth/ProtectedRoute';
import { SessionTimeoutWarning } from './components/auth/SessionTimeoutWarning';

// Hooks
import { useSessionTimeout } from './hooks/useSessionTimeout';

// Placeholder components (se implementarán después)
import { AdminDashboard } from './pages/AdminDashboard';
import { UserDashboard } from './pages/UserDashboard';

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Aplicación principal
 */
function App() {
  const { initialize, isLoading } = useAuthStore();
  const { showWarning, minutesRemaining, extendSession } = useSessionTimeout();

  // ============================================================================
  // Inicialización
  // ============================================================================
  /**
   * Inicializa el estado de autenticación al montar la app
   * - Verifica si hay sesión activa en localStorage
   * - Configura listener para cambios de auth
   */
  useEffect(() => {
    initialize();
  }, [initialize]);

  // ============================================================================
  // Loading State Global
  // ============================================================================
  // Mientras se inicializa la autenticación, mostrar splash screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          {/* Logo/Icono */}
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sistema CEA CONAFE
          </h1>

          {/* Spinner */}
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mt-4"></div>

          <p className="text-gray-600 mt-4">Cargando aplicación...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render Principal
  // ============================================================================
  return (
    <BrowserRouter>
      {/* Modal de advertencia de sesión por expirar */}
      <SessionTimeoutWarning
        open={showWarning}
        minutesRemaining={minutesRemaining}
        onExtend={extendSession}
      />

      <Routes>
        {/* ====================================================================
            Ruta Pública: Login
            ==================================================================== */}
        <Route path="/login" element={<LoginForm />} />

        {/* ====================================================================
            Rutas Protegidas: Admin
            ==================================================================== */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        {/* ====================================================================
            Rutas Protegidas: Usuario Regular
            ==================================================================== */}
        <Route
          path="/dashboard"
          element={
            <UserRoute>
              <UserDashboard />
            </UserRoute>
          }
        />

        {/* ====================================================================
            Ruta Raíz: Redirigir según estado de autenticación
            ==================================================================== */}
        <Route
          path="/"
          element={<RootRedirect />}
        />

        {/* ====================================================================
            Ruta 404: No Encontrada
            ==================================================================== */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

// ============================================================================
// Componente: RootRedirect
// ============================================================================
/**
 * Redirige desde la raíz según el estado de autenticación
 * - Si no está autenticado → /login
 * - Si es admin → /admin
 * - Si es usuario regular → /dashboard
 */
function RootRedirect() {
  const { isAuthenticated, isAdmin } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isAdmin()) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

// ============================================================================
// Componente: NotFound
// ============================================================================
/**
 * Página 404 - No encontrada
 */
function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        {/* Icono de error */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
          <svg
            className="h-8 w-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Título */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Página No Encontrada
        </h2>

        {/* Descripción */}
        <p className="text-gray-600 mb-6">
          La página que buscas no existe o ha sido movida.
        </p>

        {/* Botón de regresar */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <svg
            className="mr-2 -ml-1 h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Regresar
        </button>
      </div>
    </div>
  );
}

export default App;
