import { useParams } from 'react-router-dom';
import { ProjetosListPage } from './ProjetosListPage';

/** Página dedicada por área/tipo de projeto (/projetos/area/:tipo).
 *  key={nome} força remount completo ao navegar entre áreas (estado isolado). */
export function ProjetosAreaPage() {
  const { tipo } = useParams<{ tipo: string }>();
  const nome = decodeURIComponent(tipo);
  return <ProjetosListPage key={nome} tipoFixo={nome} />;
}
