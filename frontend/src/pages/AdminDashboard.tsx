/**
 * Página: AdminDashboard
 * =======================
 * Dashboard principal para administradores con diseño CONAFE
 *
 * Características:
 * - Gestión de archivos Master (subida, validación)
 * - Procesamiento de CEA
 * - Visualización de historial
 * - Descarga de archivos CEA
 * - Diseño profesional con paleta CONAFE
 * - Actualizaciones en tiempo real con Supabase Realtime
 */

import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMasterUploadsRealtime, useCeaFilesRealtime } from '../hooks/useRealtime';
import { MasterUpload } from '../components/admin/MasterUpload';
import { HistorialMasters } from '../components/admin/HistorialMasters';
import { HistorialCea } from '../components/admin/HistorialCea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Dashboard de administrador
 */
export function AdminDashboard() {
  const { user, profile, logout } = useAuthStore();

  // ============================================================================
  // Estado para pestaña activa y contadores de eventos en tiempo real
  // ============================================================================
  const [activeTab, setActiveTab] = useState('subir-masters');
  const [masterUpdates, setMasterUpdates] = useState(0);
  const [ceaUpdates, setCeaUpdates] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // ============================================================================
  // Configurar Realtime para Master Uploads
  // ============================================================================
  useMasterUploadsRealtime({
    onUpdate: (payload) => {
      console.log('🔄 Master actualizado:', payload.new);
      setMasterUpdates(prev => prev + 1);
      setRealtimeConnected(true);

      // Ejemplo: Mostrar notificación cuando un Master es validado
      if (payload.new.status === 'validated') {
        console.log('✅ Master validado:', payload.new.file_name);
      } else if (payload.new.status === 'error') {
        console.log('❌ Error en Master:', payload.new.file_name);
      }
    },
    onInsert: (payload) => {
      console.log('📄 Nuevo Master subido:', payload.new);
      setMasterUpdates(prev => prev + 1);
      setRealtimeConnected(true);
    },
  });

  // ============================================================================
  // Configurar Realtime para CEA Files
  // ============================================================================
  useCeaFilesRealtime({
    onUpdate: (payload) => {
      console.log('🔄 CEA actualizado:', payload.new);
      setCeaUpdates(prev => prev + 1);
      setRealtimeConnected(true);

      // Ejemplo: Mostrar notificación cuando un CEA se completa
      if (payload.new.processing_status === 'completed') {
        console.log('✅ CEA generado exitosamente:', payload.new.file_name);
      } else if (payload.new.processing_status === 'failed') {
        console.log('❌ Error al generar CEA:', payload.new.file_name);
      }
    },
    onInsert: (payload) => {
      console.log('📊 Nuevo CEA iniciado:', payload.new);
      setCeaUpdates(prev => prev + 1);
      setRealtimeConnected(true);
    },
  });

  // ============================================================================
  // Manejador de logout
  // ============================================================================
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-conafe-gris-100 to-white">
      {/* Header con estilo CONAFE */}
      <header className="bg-white shadow-md border-b-4 border-conafe-guinda">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            {/* Logo y Título */}
            <div className="flex items-center space-x-4">
              {/* Logo CONAFE */}
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-conafe-guinda shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-conafe-guinda">
                  Panel de Administración
                </h1>
                <p className="text-sm text-conafe-gris-600">
                  Sistema de Gestión de Archivos Excel CEA
                </p>
              </div>
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              {/* Información del usuario */}
              {/* <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-conafe-gris-900">
                  {profile?.full_name || user?.email}
                </p>
                <p className="text-xs text-conafe-gris-600">
                  Rol: <span className="font-bold text-conafe-guinda uppercase">{profile?.role}</span>
                </p>
              </div> */}

              {/* Indicador de Realtime */}
              <div className="hidden lg:flex items-center space-x-2 px-3 py-1 rounded-full bg-conafe-verde-light border border-conafe-verde">
                <div className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-conafe-verde animate-pulse' : 'bg-conafe-gris-600'}`} />
                <span className="text-xs font-medium text-conafe-verde">
                  {realtimeConnected ? 'En Vivo' : 'Conectando...'}
                </span>
                {(masterUpdates > 0 || ceaUpdates > 0) && (
                  <span className="text-xs text-conafe-gris-600">
                    ({masterUpdates + ceaUpdates})
                  </span>
                )}
              </div>

              {/* Badge de Admin */}
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-conafe-guinda text-white shadow-md">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Administrador
              </span>

              {/* Botón de logout */}
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-conafe-guinda hover:bg-conafe-guinda-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-conafe-guinda transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <svg
                  className="mr-2 -ml-1 h-4 w-4"
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
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Barra de pestañas */}
          <TabsList className="w-full grid grid-cols-3 h-12 bg-conafe-gris-100 rounded-xl mb-6 p-1">
            <TabsTrigger
              value="subir-masters"
              className="aria-selected:bg-conafe-guinda aria-selected:text-white aria-selected:shadow-lg rounded-lg text-sm font-semibold transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Subir Masters
            </TabsTrigger>
            <TabsTrigger
              value="historial-masters"
              className="aria-selected:bg-conafe-guinda aria-selected:text-white aria-selected:shadow-lg rounded-lg text-sm font-semibold transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Historial Masters
            </TabsTrigger>
            <TabsTrigger
              value="historial-cea"
              className="aria-selected:bg-conafe-guinda aria-selected:text-white aria-selected:shadow-lg rounded-lg text-sm font-semibold transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Historial CEA
            </TabsTrigger>
          </TabsList>

          {/* Pestaña 1: Subir Masters - mismo panel que antes */}
          <TabsContent value="subir-masters">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-conafe-gris-300">
              <MasterUpload />
            </div>
          </TabsContent>

          {/* Pestaña 2: Historial Masters */}
          <TabsContent value="historial-masters">
            <HistorialMasters />
          </TabsContent>

          {/* Pestaña 3: Historial CEA */}
          <TabsContent value="historial-cea">
            <HistorialCea />
          </TabsContent>
        </Tabs>

        {/* Footer informativo */}
        <div className="mt-8 text-center">
          <p className="text-sm text-conafe-gris-600">
            Consejo Nacional de Fomento Educativo • Sistema CEA {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  );
}
