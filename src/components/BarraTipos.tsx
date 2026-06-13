import {
  Palette, Share2, Globe, Target, Code2, Briefcase, Megaphone, Camera, PenTool,
  Tag, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Ícone que referencia o tipo de projeto (por palavra-chave no nome). */
export function iconeTipo(nome: string): LucideIcon {
  const n = nome.toLowerCase();
  if (n.includes('social')) return Share2;
  if (n.includes('web') || n.includes('site')) return Globe;
  if (n.includes('tráfeg') || n.includes('trafeg') || n.includes('ads') || n.includes('anúnc') || n.includes('anunc')) return Target;
  if (n.includes('design')) return Palette;
  if (n.includes('dev') || n.includes('program') || n.includes('cod')) return Code2;
  if (n.includes('gest') || n.includes('admin') || n.includes('consult')) return Briefcase;
  if (n.includes('market') || n.includes('mídia') || n.includes('midia') || n.includes('lança') || n.includes('lanca')) return Megaphone;
  if (n.includes('foto') || n.includes('vídeo') || n.includes('video') || n.includes('audiovis')) return Camera;
  if (n.includes('redaç') || n.includes('redac') || n.includes('copy') || n.includes('conteúd') || n.includes('conteud')) return PenTool;
  return Tag;
}

/** Coluna estreita à esquerda da página com um ícone por tipo de projeto. */
export function BarraTipos({
  tipos, ativo, onChange,
}: {
  tipos: string[];
  ativo: string;
  onChange: (t: string) => void;
}) {
  if (tipos.length === 0) return null;
  return (
    <aside className="hidden shrink-0 flex-col gap-2 lg:flex">
      {tipos.map((t) => {
        const selecionado = ativo === t;
        const Icon = iconeTipo(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            title={t}
            aria-label={t}
            aria-pressed={selecionado}
            className={cn(
              'grid size-12 place-items-center rounded-xl border transition-colors',
              selecionado
                ? 'border-primary/50 bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            <Icon className="size-5" />
          </button>
        );
      })}
    </aside>
  );
}

/** Pills de tipo (mobile) — scroll horizontal; espelha a BarraTipos no desktop. */
export function PillsTipos({
  tipos, ativo, onChange,
}: {
  tipos: string[];
  ativo: string;
  onChange: (t: string) => void;
}) {
  if (tipos.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 lg:hidden [&::-webkit-scrollbar]:hidden">
      {tipos.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={cn(
            'shrink-0 rounded-full border px-3.5 py-1 text-sm transition-colors',
            ativo === f
              ? 'border-primary/50 bg-primary/15 text-primary'
              : 'border-border text-muted-foreground hover:bg-secondary',
          )}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
