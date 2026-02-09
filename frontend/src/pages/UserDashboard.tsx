/**
 * Página: UserDashboard
 * ======================
 * Dashboard para usuarios regulares
 *
 * Características:
 * - Visualización del último CEA generado
 * - Descarga del archivo CEA
 * - Vista simplificada (sin gestión de archivos)
 */

import * as React from 'react';
import { useAuthStore } from '../store/authStore';
import { useCeaStore } from '../store/ceaStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Dashboard de usuario regular
 */
export function UserDashboard() {
  const { user, profile, logout } = useAuthStore();
  const { latestCea, fetchLatest, downloadCea, isLoading } = useCeaStore();

  // ============================================================================
  // Efectos
  // ============================================================================

  /**
   * Cargar último CEA al montar
   */
  React.useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  // ============================================================================
  // Manejadores
  // ============================================================================

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleDownload = async () => {
    if (latestCea) {
      try {
        await downloadCea(latestCea.id);
      } catch (error) {
        console.error('Error descargando CEA:', error);
      }
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Título */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Panel de Usuario
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Sistema de Gestión de Archivos Excel CEA
              </p>
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              {/* Información del usuario */}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.full_name || user?.email}
                </p>
                <p className="text-xs text-gray-500">
                  Rol: <span className="font-semibold uppercase">{profile?.role}</span>
                </p>
              </div>

              {/* Badge de Usuario */}
              <Badge variant="success">Usuario</Badge>

              {/* Botón de logout */}
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Último Reporte CEA</CardTitle>
            <CardDescription>
              Descarga el reporte CEA más reciente generado
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Loading */}
            {isLoading && (
              <div className="py-12">
                <Spinner size="lg" text="Cargando reporte..." />
              </div>
            )}

            {/* Sin CEA disponible */}
            {!isLoading && !latestCea && (
              <div className="text-center py-12">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                  <svg
                    className="h-8 w-8 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay reportes CEA disponibles
                </h3>
                <p className="text-gray-600">
                  Aún no se ha generado ningún reporte. Contacta al administrador.
                </p>
              </div>
            )}

            {/* CEA disponible */}
            {!isLoading && latestCea && (
              <div className="space-y-6">
                {/* Información del archivo */}
                <div className="border-2 border-blue-500 bg-blue-50 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {latestCea.file_name}
                        </h3>
                        <Badge variant="success">Más reciente</Badge>
                      </div>

                      <p className="text-sm text-gray-600">
                        Generado el {formatDate(latestCea.created_at)}
                      </p>
                    </div>

                    {/* Icono */}
                    <div className="bg-blue-100 p-4 rounded-full">
                      <svg
                        className="h-8 w-8 text-blue-600"
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
                  </div>

                  {/* Estadísticas */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Tamaño del archivo</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatFileSize(latestCea.file_size)}
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Total de registros</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {latestCea.total_records || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Botón de descarga */}
                  <Button
                    onClick={handleDownload}
                    className="w-full"
                    size="lg"
                  >
                    <svg
                      className="mr-2 h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Descargar Reporte CEA
                  </Button>
                </div>

                {/* Información adicional */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    📋 Información del Reporte
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Este reporte contiene el Concentrado de Educación y Acompañamiento (CEA)</li>
                    <li>• Formato: Microsoft Excel (.xlsx)</li>
                    <li>• Incluye datos agregados de alumnos, servicios y figuras educativas</li>
                    <li>• Los datos están organizados por microrregión</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
