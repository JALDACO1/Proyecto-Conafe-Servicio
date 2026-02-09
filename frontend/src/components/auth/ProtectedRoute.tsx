/**
 * Componente: ProtectedRoute
 * ===========================
 * Protege rutas que requieren autenticación
 *
 * Características:
 * - Verifica autenticación
 * - Verifica rol (admin/user)
 * - Redirige al login si no está autenticado
 * - Redirige a página no autorizada si no tiene permisos
 * - Muestra loading state mientras verifica
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

// ============================================================================
// Tipos
// ============================================================================

interface ProtectedRouteProps {
  children: ReactNode;              // Componente a renderizar si está autenticado
  requireAdmin?: boolean;           // ¿Requiere rol admin? (default: false)
  redirectTo?: string;              // Ruta a redirigir si no autenticado (default: '/login')
}

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Componente que protege rutas privadas
 *
 * @example
 * // Ruta que requiere autenticación (cualquier rol)
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 *
 * @example
 * // Ruta que requiere rol admin
 * <ProtectedRoute requireAdmin>
 *   <AdminDashboard />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
  children,
  requireAdmin = false,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore();

  // ============================================================================
  // Loading State
  // ============================================================================
  // Mientras se verifica la sesión, mostrar spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          {/* Spinner */}
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>

          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // No autenticado
  // ============================================================================
  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // ============================================================================
  // Requiere admin pero no es admin
  // ============================================================================
  // Si la ruta requiere admin pero el usuario no lo es, mostrar no autorizado
  if (requireAdmin && !isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          {/* Icono de candado */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          {/* Título */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Acceso Denegado
          </h2>

          {/* Descripción */}
          <p className="text-gray-600 mb-6">
            No tienes permisos para acceder a esta página. Solo los
            administradores pueden ver este contenido.
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

  // ============================================================================
  // Autorizado - Renderizar children
  // ============================================================================
  return <>{children}</>;
}

// ============================================================================
// Componente Auxiliar: AdminRoute
// ============================================================================

/**
 * Atajo para rutas que requieren admin
 *
 * @example
 * <AdminRoute>
 *   <AdminDashboard />
 * </AdminRoute>
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute requireAdmin>{children}</ProtectedRoute>;
}

// ============================================================================
// Componente Auxiliar: UserRoute
// ============================================================================

/**
 * Atajo para rutas que requieren autenticación (cualquier rol)
 *
 * @example
 * <UserRoute>
 *   <UserDashboard />
 * </UserRoute>
 */
export function UserRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
