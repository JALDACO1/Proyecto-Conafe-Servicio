import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Función helper para combinar clases de Tailwind CSS
 * Usa clsx para concatenar clases condicionales y twMerge para resolver conflictos
 *
 * @param inputs - Clases CSS a combinar
 * @returns String con las clases combinadas y optimizadas
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-blue-500", "hover:bg-blue-600")
 * // => "px-2 py-1 bg-blue-500 hover:bg-blue-600"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
