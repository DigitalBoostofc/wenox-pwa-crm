import { useHistory, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TarefaForm } from './TarefaForm';
import { Button } from '@/components/ui/button';

/** Página inteira de cadastro/edição de tarefa — fina casca em volta
 *  do TarefaForm (o mesmo formulário usado no cadastro inline da lista). */
export function TarefaFormPage({ id: idProp }: { id?: string } = {}) {
  const history = useHistory();
  const params = useParams<{ id?: string }>();
  const { search } = useLocation();
  const id = idProp ?? params.id;

  const qs = new URLSearchParams(search);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => history.goBack()} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h2 className="text-lg font-semibold">{id ? 'Editar' : 'Nova'} tarefa</h2>
      </div>

      <TarefaForm
        tarefaId={id}
        presetProjeto={qs.get('projeto') ?? undefined}
        presetCliente={qs.get('cliente') ?? undefined}
        onSalvo={() => history.push('/tarefas')}
        onApagado={() => history.push('/tarefas')}
        onCancelar={() => history.goBack()}
      />
    </div>
  );
}
