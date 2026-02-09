/**
 * CORS Headers para Edge Functions
 * ==================================
 * Define los headers CORS necesarios para permitir peticiones desde el frontend.
 * Estos headers se deben incluir en TODAS las respuestas de las Edge Functions.
 */

/**
 * Headers CORS estándar para Edge Functions
 * Permite peticiones desde cualquier origen (*)
 * En producción, considera limitar a tu dominio específico
 */
export const corsHeaders = {
  // Permitir peticiones desde cualquier origen
  // En producción: cambiar '*' por 'https://tu-dominio.com'
  'Access-Control-Allow-Origin': '*',

  // Headers que el cliente puede enviar
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  // Métodos HTTP permitidos
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',

  // Permitir envío de credenciales (cookies, auth headers)
  'Access-Control-Allow-Credentials': 'true',

  // Tiempo que el navegador puede cachear la respuesta preflight
  'Access-Control-Max-Age': '86400', // 24 horas
};

/**
 * Maneja peticiones OPTIONS (preflight requests)
 * Los navegadores envían OPTIONS antes de la petición real para verificar CORS
 *
 * @returns Response con headers CORS y status 200
 *
 * @example
 * if (req.method === 'OPTIONS') {
 *   return handleCorsPreflightRequest();
 * }
 */
export function handleCorsPreflightRequest(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * Crea una respuesta JSON con headers CORS incluidos
 *
 * @param data - Datos a retornar (serán convertidos a JSON)
 * @param status - Código HTTP de status (default: 200)
 * @returns Response con JSON y headers CORS
 *
 * @example
 * return corsJsonResponse({ success: true, message: 'OK' });
 * return corsJsonResponse({ error: 'Bad request' }, 400);
 */
export function corsJsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Crea una respuesta de error con headers CORS incluidos
 *
 * @param message - Mensaje de error
 * @param status - Código HTTP de status (default: 500)
 * @param details - Detalles adicionales del error (opcional)
 * @returns Response con error y headers CORS
 *
 * @example
 * return corsErrorResponse('Archivo no encontrado', 404);
 * return corsErrorResponse('Error de validación', 400, { field: 'email' });
 */
export function corsErrorResponse(
  message: string,
  status: number = 500,
  details?: any
): Response {
  return corsJsonResponse(
    {
      error: message,
      details,
    },
    status
  );
}
