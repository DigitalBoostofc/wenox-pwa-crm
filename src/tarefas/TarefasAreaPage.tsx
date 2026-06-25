import { useParams } from 'react-router-dom';
import { TarefasListPage } from './TarefasListPage';

export function TarefasAreaPage() {
  const { tipo } = useParams<{ tipo: string }>();
  const nome = decodeURIComponent(tipo);
  // key={nome} força remount completo ao navegar entre áreas (estado isolado por área).
  return <TarefasListPage key={nome} tipoFixo={nome} />;
}
