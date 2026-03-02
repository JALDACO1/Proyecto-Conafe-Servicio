/**
 * Componente: SessionTimeoutWarning
 * ===================================
 * Modal de advertencia que aparece cuando la sesión está por expirar.
 * Permite al usuario extender la sesión o cerrarla manualmente.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

interface SessionTimeoutWarningProps {
  open: boolean;
  minutesRemaining: number;
  onExtend: () => void;
}

export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  open,
  minutesRemaining,
  onExtend,
}) => {
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Sesión por expirar
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Tu sesión se cerrará en{' '}
            <span className="font-bold text-amber-700">
              {minutesRemaining} {minutesRemaining === 1 ? 'minuto' : 'minutos'}
            </span>{' '}
            por inactividad.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={handleLogout}>
            Cerrar sesión
          </Button>
          <Button onClick={onExtend} className="bg-conafe-verde hover:bg-conafe-verde/90">
            Continuar sesión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
