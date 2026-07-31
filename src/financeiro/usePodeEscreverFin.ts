import { useAuth } from '@/auth/useAuth';
import { canEscreverFinanceiro } from '@/auth/perms';

export function usePodeEscreverFin(): boolean {
  const { user } = useAuth();
  return canEscreverFinanceiro(user?.role);
}
