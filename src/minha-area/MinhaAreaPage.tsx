import { useAuth } from '@/auth/useAuth';
import type { Role } from '@/auth/perms';
import { DadosAgenciaProvider } from '@/dashboard/useDadosAgencia';
import { MinhaProdutividadeBloco } from './blocos';
import { MinhasTarefasBloco } from './blocosTarefas';

const ROLES_COMPLETOS = new Set(['Owner', 'Admin', 'Gestor', 'Membro']);

export function MinhaAreaPage() {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role as Role;
  const completo = ROLES_COMPLETOS.has(role);
  const somenteLeitura = role === 'Visualizador';

  return (
    <DadosAgenciaProvider>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <MinhasTarefasBloco somenteLeitura={somenteLeitura} />

        {completo && <MinhaProdutividadeBloco />}
      </div>
    </DadosAgenciaProvider>
  );
}
