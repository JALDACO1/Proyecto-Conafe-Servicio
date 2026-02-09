/**
 * Componente: LoginForm
 * ======================
 * Formulario de inicio de sesión con diseño CONAFE
 *
 * Características:
 * - Validación de email y contraseña
 * - Manejo de errores
 * - Loading states
 * - Paleta de colores CONAFE oficial
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Formulario de inicio de sesión
 *
 * @example
 * <LoginForm />
 */
export function LoginForm() {
  // Estado local del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Estado global de autenticación
  const { login, isAdmin, error: globalError } = useAuthStore();

  // Navegación
  const navigate = useNavigate();

  // ============================================================================
  // Manejador de submit
  // ============================================================================
  /**
   * Maneja el envío del formulario
   *
   * @param e - Evento del formulario
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    // Validación básica
    if (!email || !password) {
      setLocalError('Por favor ingresa tu email y contraseña');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError('Por favor ingresa un email válido');
      return;
    }

    try {
      setIsSubmitting(true);

      // Intentar iniciar sesión
      await login(email, password);

      // Redirigir según el rol del usuario
      if (isAdmin()) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      // El error ya se maneja en el store
      console.error('Error en login:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Error a mostrar (local o global)
  const displayError = localError || globalError;

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-conafe-gris-100 via-white to-conafe-verde-light px-4">
      <div className="max-w-md w-full">
        {/* Header con logo CONAFE */}
        <div className="text-center mb-8">
          {/* Logo circular con ícono */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-conafe-guinda shadow-lg mb-4">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          {/* Título principal */}
          <h1 className="text-4xl font-bold text-conafe-guinda mb-2">
            Sistema CEA
          </h1>

          {/* Subtítulo institucional */}
          <p className="text-base text-conafe-gris-600 font-medium">
            Consejo Nacional de Fomento Educativo
          </p>
          <p className="text-sm text-conafe-gris-600 mt-1">
            Gestión de Archivos Excel CEA
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-conafe-gris-300">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campo: Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-conafe-gris-900 mb-2"
              >
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="block w-full px-4 py-3 border border-conafe-gris-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-conafe-guinda focus:border-conafe-guinda disabled:bg-conafe-gris-100 disabled:cursor-not-allowed transition-all text-conafe-gris-900"
                placeholder="usuario@conafe.gob.mx"
                autoComplete="email"
                required
              />
            </div>

            {/* Campo: Contraseña */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-conafe-gris-900 mb-2"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="block w-full px-4 py-3 border border-conafe-gris-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-conafe-guinda focus:border-conafe-guinda disabled:bg-conafe-gris-100 disabled:cursor-not-allowed transition-all text-conafe-gris-900"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {/* Error */}
            {displayError && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-md p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-red-800">{displayError}</p>
                </div>
              </div>
            )}

            {/* Botón Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-semibold text-white bg-conafe-guinda hover:bg-conafe-guinda-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-conafe-guinda disabled:bg-conafe-gris-300 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-conafe-gris-300">
            <p className="text-xs text-center text-conafe-gris-600">
              Sistema de gestión interna • CONAFE {new Date().getFullYear()}
            </p>
          </div>
        </div>

        {/* Instrucciones de desarrollo */}
        {import.meta.env.DEV && (
          <div className="mt-6 bg-conafe-ambar/10 border-l-4 border-conafe-ambar rounded-md p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-conafe-ambar mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-conafe-gris-900 mb-2">
                  🔧 Modo Desarrollo
                </p>
                <p className="text-xs text-conafe-gris-600">
                  Para crear un usuario admin, ejecuta en Supabase SQL Editor:
                </p>
                <pre className="mt-2 text-xs bg-white p-2 rounded border border-conafe-gris-300 overflow-x-auto">
                  {`SELECT promote_user_to_admin('email@example.com');`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
