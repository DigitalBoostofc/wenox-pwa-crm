import { pb } from '@/lib/pocketbase';

/* -------------------------------------------------------------------------- */
/*  Config da conexão WhatsApp (coleção wa_config — só Owner/Admin)            */
/* -------------------------------------------------------------------------- */

export interface WaConfig {
  id?: string;
  subdomain: string;
  token: string;
  instance_name: string;
  numero: string;
  status: string;
  janela_inicio: string;
  janela_fim: string;
  dias_uteis: number[];
  ativo: boolean;
}

const VAZIO: WaConfig = {
  subdomain: '', token: '', instance_name: 'wenox', numero: '', status: 'desconectado',
  janela_inicio: '08:00', janela_fim: '19:00', dias_uteis: [1, 2, 3, 4, 5], ativo: false,
};

export async function getWaConfig(): Promise<WaConfig> {
  try {
    // sort determinístico: com duplicidade de wa_config, carrega sempre a mais
    // recente (não um registro indeterminado que faria a config "oscilar").
    const r = await pb.collection('wa_config').getList(1, 1, { sort: '-created' });
    const rec = r.items[0] as unknown as WaConfig | undefined;
    if (!rec) return { ...VAZIO };
    return {
      id: (rec as { id: string }).id,
      subdomain: rec.subdomain ?? '',
      token: rec.token ?? '',
      instance_name: rec.instance_name ?? 'wenox',
      numero: rec.numero ?? '',
      status: rec.status ?? 'desconectado',
      janela_inicio: rec.janela_inicio || '08:00',
      janela_fim: rec.janela_fim || '19:00',
      dias_uteis: Array.isArray(rec.dias_uteis) ? rec.dias_uteis : [1, 2, 3, 4, 5],
      ativo: !!rec.ativo,
    };
  } catch {
    return { ...VAZIO };
  }
}

export async function salvarWaConfig(c: WaConfig): Promise<void> {
  const dados = {
    subdomain: c.subdomain.trim(),
    token: c.token.trim(),
    instance_name: c.instance_name.trim() || 'wenox',
    numero: c.numero.trim(),
    janela_inicio: c.janela_inicio,
    janela_fim: c.janela_fim,
    dias_uteis: c.dias_uteis,
    ativo: c.ativo,
  };
  if (c.id) await pb.collection('wa_config').update(c.id, dados);
  else await pb.collection('wa_config').create({ ...dados, status: 'desconectado' });
}

/* -------------------------------------------------------------------------- */
/*  Automações (coleção automacoes)                                            */
/* -------------------------------------------------------------------------- */

export type CategoriaAutomacao = 'interno' | 'cliente' | 'digest';
export type PublicoAutomacao =
  | 'responsavel' | 'proximo' | 'gestor' | 'cliente' | 'mencionado' | 'todos_membros';

export interface Automacao {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  categoria: CategoriaAutomacao;
  publico: PublicoAutomacao;
  antecedencia_horas: number;
  hora_envio: string;
  repetir_a_cada_horas: number;
  template: string;
  filtro_tipos_etapa?: string[];
  filtro_membros?: string[];
  ordem?: number;
}

export const CATEGORIA_LABEL: Record<CategoriaAutomacao, string> = {
  interno: 'Equipe', cliente: 'Cliente', digest: 'Resumo diário',
};
export const PUBLICO_LABEL: Record<PublicoAutomacao, string> = {
  responsavel: 'Responsável da etapa',
  proximo: 'Próximo responsável',
  gestor: 'Gestor',
  cliente: 'Cliente',
  mencionado: 'Mencionado',
  todos_membros: 'Cada membro',
};

/** Placeholders aceitos nos templates (para a ajuda da UI). */
export const PLACEHOLDERS = [
  '{{membro}}', '{{tarefa}}', '{{etapa}}', '{{prazo}}', '{{cliente}}', '{{projeto}}', '{{link}}',
];

export async function listAutomacoes(): Promise<Automacao[]> {
  const r = await pb.collection('automacoes').getFullList({ sort: 'ordem' });
  return r as unknown as Automacao[];
}

export async function atualizarAutomacao(id: string, patch: Partial<Automacao>): Promise<void> {
  await pb.collection('automacoes').update(id, patch);
}
