import { useParams, Redirect } from 'react-router-dom';
import { TarefasListPage } from './TarefasListPage';

export function TarefasAreaPage() {
  const { tipo } = useParams<{ tipo: string }>();
  let nome: string;
  try {
    nome = decodeURIComponent(tipo);
  } catch {
    // URL com percent-encoding malformado (ex.: /tarefas/area/%) faz decodeURIComponent
    // lançar URIError; sem Error Boundary isso derrubaria o app inteiro. Cai na página geral.
    return <Redirect to="/tarefas" />;
  }
  // key={nome} força remount completo ao navegar entre áreas (estado isolado por área).
  return <TarefasListPage key={nome} tipoFixo={nome} />;
}
