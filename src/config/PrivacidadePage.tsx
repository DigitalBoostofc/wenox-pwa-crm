import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import {
  MODULOS_INFO,
  ROLES_CONFIGURÁVEIS,
  PERMISSOES_PADRAO,
  carregarPermissoes,
  salvarPermissoes,
  type MatrizPermissoes,
  type Modulo,
} from './permissoesConfig';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function PrivacidadePage() {
  const history = useHistory();
  const [matriz, setMatriz] = useState<MatrizPermissoes>(() => carregarPermissoes());
  const [salvo, setSalvo] = useState(false);

  function toggle(role: string, modulo: Modulo) {
    setMatriz((prev) => ({
      ...prev,
      [role]: { ...prev[role], [modulo]: !prev[role]?.[modulo] },
    }));
    setSalvo(false);
  }

  function salvar() {
    salvarPermissoes(matriz);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  function resetar() {
    setMatriz(structuredClone(PERMISSOES_PADRAO));
    setSalvo(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => history.goBack()}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-base font-semibold">Privacidade &amp; Acessos</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Defina quais módulos cada papel de usuário pode acessar. O papel <strong>Owner</strong> sempre tem acesso total e não pode ser alterado.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-foreground">Módulo</th>
              <th className="px-3 py-3 text-center font-medium text-muted-foreground">Owner</th>
              {ROLES_CONFIGURÁVEIS.map((role) => (
                <th key={role} className="px-3 py-3 text-center font-medium text-foreground">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULOS_INFO.map((mod, i) => (
              <tr
                key={mod.id}
                className={cn(
                  'border-b border-border last:border-0',
                  i % 2 !== 0 && 'bg-muted/20',
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(!mod.disponivel && 'text-muted-foreground')}>
                      {mod.label}
                    </span>
                    {!mod.disponivel && (
                      <Badge variant="muted" className="text-[10px] leading-none">
                        em breve
                      </Badge>
                    )}
                  </div>
                </td>

                {/* Owner: sempre marcado, desabilitado */}
                <td className="px-3 py-3 text-center">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      className="size-4 cursor-not-allowed accent-primary opacity-40"
                      aria-label={`Owner — ${mod.label}`}
                    />
                  </div>
                </td>

                {ROLES_CONFIGURÁVEIS.map((role) => (
                  <td key={role} className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={!!matriz[role]?.[mod.id]}
                        onChange={() => toggle(role, mod.id)}
                        className="size-4 cursor-pointer accent-primary"
                        aria-label={`${role} — ${mod.label}`}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={salvar} variant={salvo ? 'outline' : 'default'}>
          <Save className="size-4" />
          {salvo ? 'Salvo com sucesso!' : 'Salvar alterações'}
        </Button>
        <Button variant="ghost" onClick={resetar}>
          <RotateCcw className="size-4" />
          Restaurar padrões
        </Button>
      </div>
    </div>
  );
}
