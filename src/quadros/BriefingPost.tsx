import { useState } from 'react';

type Slide = { titulo: string; texto: string };
type Tela = { conteudo: string; interacao: string };

const INTERACOES = [
  { id: '',                    label: 'Nenhuma' },
  { id: 'enquete',             label: 'Enquete' },
  { id: 'quiz',                label: 'Quiz' },
  { id: 'caixa_perguntas',     label: 'Caixa de perguntas' },
  { id: 'contagem_regressiva', label: 'Contagem regressiva' },
  { id: 'link',                label: 'Link' },
] as const;

const c = {
  input:    'w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
  textarea: 'w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
  select:   'h-7 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function FeedFields({ d, patch }: { d: Record<string, unknown>; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Field label="Headline">
        <textarea rows={2} className={c.textarea} defaultValue={(d.headline as string) ?? ''} onBlur={(e) => patch('headline', e.target.value)} placeholder="Frase principal do post" />
      </Field>
      <Field label="Subtítulo">
        <textarea rows={2} className={c.textarea} defaultValue={(d.subtitulo as string) ?? ''} onBlur={(e) => patch('subtitulo', e.target.value)} placeholder="Complemento da headline" />
      </Field>
      <Field label="Texto de apoio">
        <textarea rows={3} className={c.textarea} defaultValue={(d.texto_apoio as string) ?? ''} onBlur={(e) => patch('texto_apoio', e.target.value)} placeholder="Informação extra no post" />
      </Field>
      <Field label="CTA">
        <input className={c.input} defaultValue={(d.cta as string) ?? ''} onBlur={(e) => patch('cta', e.target.value)} placeholder="Ex: Saiba mais" />
      </Field>
      <Field label="Observações">
        <textarea rows={2} className={c.textarea} defaultValue={(d.observacoes as string) ?? ''} onBlur={(e) => patch('observacoes', e.target.value)} placeholder="Orientações adicionais para o designer" />
      </Field>
    </div>
  );
}

function CarrosselFields({ d, patch }: { d: Record<string, unknown>; patch: (k: string, v: unknown) => void }) {
  const [slides, setSlides] = useState<Slide[]>(() => {
    const raw = d.slides;
    return Array.isArray(raw) ? (raw as Slide[]) : [];
  });

  function saveSlides(next: Slide[]) {
    setSlides(next);
    patch('slides', next);
  }

  function updateSlide(i: number, field: keyof Slide, val: string) {
    setSlides((prev) => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
  }

  function saveSlide(i: number, field: keyof Slide, val: string) {
    const next = slides.map((s, j) => j === i ? { ...s, [field]: val } : s);
    saveSlides(next);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Field label="Capa/gancho">
        <textarea rows={2} className={c.textarea} defaultValue={(d.capa as string) ?? ''} onBlur={(e) => patch('capa', e.target.value)} placeholder="Texto da capa — o que chama atenção" />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Slides</span>
        {slides.map((s, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-background/40 p-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <input
                className={c.input}
                placeholder={`Título — slide ${i + 1}`}
                value={s.titulo}
                onChange={(e) => updateSlide(i, 'titulo', e.target.value)}
                onBlur={(e) => saveSlide(i, 'titulo', e.target.value)}
              />
              <textarea
                rows={2}
                className={c.textarea}
                placeholder="Texto do slide"
                value={s.texto}
                onChange={(e) => updateSlide(i, 'texto', e.target.value)}
                onBlur={(e) => saveSlide(i, 'texto', e.target.value)}
              />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <button type="button" disabled={i === 0} onClick={() => { const n = [...slides]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; saveSlides(n); }} className="grid size-6 place-items-center rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30">↑</button>
              <button type="button" disabled={i === slides.length - 1} onClick={() => { const n = [...slides]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; saveSlides(n); }} className="grid size-6 place-items-center rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30">↓</button>
              <button type="button" onClick={() => saveSlides(slides.filter((_, j) => j !== i))} className="grid size-6 place-items-center rounded text-xs text-destructive/70 hover:bg-destructive/10 hover:text-destructive">×</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => saveSlides([...slides, { titulo: '', texto: '' }])} className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary">
          + Adicionar slide
        </button>
      </div>

      <Field label="CTA final">
        <input className={c.input} defaultValue={(d.cta_final as string) ?? ''} onBlur={(e) => patch('cta_final', e.target.value)} placeholder="Ex: Siga para mais conteúdo" />
      </Field>
      <Field label="Observações">
        <textarea rows={2} className={c.textarea} defaultValue={(d.observacoes as string) ?? ''} onBlur={(e) => patch('observacoes', e.target.value)} placeholder="Orientações adicionais" />
      </Field>
    </div>
  );
}

function StoryFields({ d, patch }: { d: Record<string, unknown>; patch: (k: string, v: unknown) => void }) {
  const [telas, setTelas] = useState<Tela[]>(() => {
    const raw = d.telas;
    return Array.isArray(raw) ? (raw as Tela[]) : [];
  });

  function saveTelas(next: Tela[]) {
    setTelas(next);
    patch('telas', next);
  }

  function updateTela(i: number, field: keyof Tela, val: string) {
    setTelas((prev) => prev.map((t, j) => j === i ? { ...t, [field]: val } : t));
  }

  function saveTela(i: number, field: keyof Tela, val: string) {
    const next = telas.map((t, j) => j === i ? { ...t, [field]: val } : t);
    saveTelas(next);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Sequência de telas</span>
        {telas.map((t, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-background/40 p-2">
            <span className="mt-1.5 shrink-0 text-[10px] font-semibold text-muted-foreground">{i + 1}</span>
            <div className="flex flex-1 flex-col gap-1.5">
              <textarea
                rows={2}
                className={c.textarea}
                placeholder="Conteúdo da tela"
                value={t.conteudo}
                onChange={(e) => updateTela(i, 'conteudo', e.target.value)}
                onBlur={(e) => saveTela(i, 'conteudo', e.target.value)}
              />
              <select
                className={c.select}
                value={t.interacao}
                onChange={(e) => saveTela(i, 'interacao', e.target.value)}
              >
                {INTERACOES.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => saveTelas(telas.filter((_, j) => j !== i))} className="mt-0.5 grid size-6 place-items-center rounded text-xs text-destructive/70 hover:bg-destructive/10 hover:text-destructive">×</button>
          </div>
        ))}
        <button type="button" onClick={() => saveTelas([...telas, { conteudo: '', interacao: '' }])} className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary">
          + Adicionar tela
        </button>
      </div>

      <Field label="CTA">
        <input className={c.input} defaultValue={(d.cta as string) ?? ''} onBlur={(e) => patch('cta', e.target.value)} placeholder="Ex: Arrasta pra ver" />
      </Field>
      <Field label="Observações">
        <textarea rows={2} className={c.textarea} defaultValue={(d.observacoes as string) ?? ''} onBlur={(e) => patch('observacoes', e.target.value)} placeholder="Orientações adicionais" />
      </Field>
    </div>
  );
}

function ReelsFields({ d, patch }: { d: Record<string, unknown>; patch: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Field label="Gancho (0–3s)">
        <textarea rows={2} className={c.textarea} defaultValue={(d.gancho as string) ?? ''} onBlur={(e) => patch('gancho', e.target.value)} placeholder="O que prende atenção nos primeiros segundos" />
      </Field>
      <Field label="Roteiro/falas">
        <textarea rows={4} className={c.textarea} defaultValue={(d.roteiro as string) ?? ''} onBlur={(e) => patch('roteiro', e.target.value)} placeholder="Texto ou falas do vídeo" />
      </Field>
      <Field label="Gravação (cenas/enquadramento)">
        <textarea rows={3} className={c.textarea} defaultValue={(d.gravacao as string) ?? ''} onBlur={(e) => patch('gravacao', e.target.value)} placeholder="Como filmar cada cena" />
      </Field>
      <Field label="Edição (cortes/legendas)">
        <textarea rows={2} className={c.textarea} defaultValue={(d.edicao as string) ?? ''} onBlur={(e) => patch('edicao', e.target.value)} placeholder="Orientações de edição" />
      </Field>
      <Field label="Áudio/trilha">
        <input className={c.input} defaultValue={(d.audio as string) ?? ''} onBlur={(e) => patch('audio', e.target.value)} placeholder="Ex: Trilha original, nome da música" />
      </Field>
      <Field label="Duração alvo">
        <input className={c.input} defaultValue={(d.duracao as string) ?? ''} onBlur={(e) => patch('duracao', e.target.value)} placeholder="Ex: 15s, 30s, 60s" />
      </Field>
      <Field label="CTA">
        <input className={c.input} defaultValue={(d.cta as string) ?? ''} onBlur={(e) => patch('cta', e.target.value)} placeholder="Chamada para ação" />
      </Field>
      <Field label="Observações">
        <textarea rows={2} className={c.textarea} defaultValue={(d.observacoes as string) ?? ''} onBlur={(e) => patch('observacoes', e.target.value)} placeholder="Orientações adicionais" />
      </Field>
    </div>
  );
}

export function BriefingPost({ formato, value = {}, onChange }: {
  formato?: string;
  value?: Record<string, unknown>;
  onChange: (b: Record<string, unknown>) => void;
}) {
  if (!formato) {
    return <p className="text-xs italic text-muted-foreground">Selecione o tipo de post acima para ver as orientações.</p>;
  }

  const fmt = formato; // narrowed to string (after `if (!formato)` early return)
  const d = (value[fmt] ?? {}) as Record<string, unknown>;

  function patch(campo: string, val: unknown) {
    onChange({ ...value, [fmt]: { ...((value[fmt] ?? {}) as Record<string, unknown>), [campo]: val } });
  }

  if (formato === 'feed')      return <FeedFields d={d} patch={patch} />;
  if (formato === 'carrossel') return <CarrosselFields d={d} patch={patch} />;
  if (formato === 'story')     return <StoryFields d={d} patch={patch} />;
  if (formato === 'reels')     return <ReelsFields d={d} patch={patch} />;
  return null;
}
