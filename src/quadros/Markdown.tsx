import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renderiza markdown (descrição do card) com estilo enxuto, estilo Trello. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-2 mt-3 text-xl font-bold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-3 text-lg font-bold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-base font-semibold first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h4>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
          hr: () => <hr className="my-3 border-border" />,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground">{children}</blockquote>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          img: ({ src, alt }) => <img src={typeof src === 'string' ? src : ''} alt={alt} className="my-2 max-h-80 rounded-md" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
