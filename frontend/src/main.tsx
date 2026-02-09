/**
 * Entry Point de la Aplicación
 * ==============================
 * Inicializa React y renderiza la app principal
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// ============================================================================
// Renderizar la aplicación
// ============================================================================

// Buscar el elemento root en el HTML
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('No se encontró el elemento #root en el DOM');
}

// Crear el root de React 18
const root = createRoot(rootElement);

// Renderizar la app en StrictMode para detectar problemas
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

console.log('🚀 Aplicación React iniciada');
