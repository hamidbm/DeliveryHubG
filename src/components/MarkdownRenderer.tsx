'use client';

import React, { useMemo, useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { visit } from 'unist-util-visit';
import { useRouter } from '../lib/navigation';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-shell-session';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';

interface MarkdownRendererProps {
  content: string;
}

const mentionRegex = /@([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._-]+)/g;

const remarkMentions = () => {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index: number | null, parent: any) => {
      if (!parent || typeof node.value !== 'string') return;
      if (parent.type === 'code' || parent.type === 'inlineCode') return;
      if (!node.value.includes('@')) return;

      const value = node.value;
      let match: RegExpExecArray | null;
      let lastIndex = 0;
      const children: any[] = [];

      while ((match = mentionRegex.exec(value)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, start) });
        }
        children.push({
          type: 'html',
          value: `<span class="mention-chip text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-md">@${match[1]}</span>`
        });
        lastIndex = end;
      }

      if (children.length === 0) return;
      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) });
      }

      if (typeof index === 'number' && parent.children) {
        parent.children.splice(index, 1, ...children);
      }
    });
  };
};

/**
 * Removes whitespace-only text nodes inside <colgroup>.
 * Pandoc emits pretty-printed HTML tables which cause
 * React hydration errors because <colgroup> may only
 * contain <col> elements.
 */
function rehypeFixColgroupWhitespace() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName === 'colgroup' && Array.isArray(node.children)) {
        node.children = node.children.filter((child: any) => {
          return !(
            child.type === 'text' &&
            typeof child.value === 'string' &&
            child.value.trim() === ''
          );
        });
      }
    });
  };
}

/**
 * Sanitization schema:
 * - Allows images (img) including base64 data URIs
 * - Allows Pandoc HTML tables (table, colgroup, col, etc.)
 * - Keeps sanitization strict enough for wiki usage
 */
const sanitizeSchema: any = {
  ...defaultSchema,

  tagNames: Array.from(
    new Set([
      ...(defaultSchema.tagNames || []),
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'colgroup',
      'col',
      'span',
      'div',
    ])
  ),

  attributes: {
    ...defaultSchema.attributes,

    img: [
      ...(defaultSchema.attributes?.img || []),
      'src',
      'alt',
      'title',
      'width',
      'height',
      'style',
      'className',
    ],

    table: ['class', 'className', 'style'],
    thead: ['class', 'className', 'style'],
    tbody: ['class', 'className', 'style'],
    tr: ['class', 'className', 'style'],
    th: ['class', 'className', 'style', 'colspan', 'rowspan'],
    td: ['class', 'className', 'style', 'colspan', 'rowspan'],
    col: ['span', 'width', 'className'],
    colgroup: ['span', 'width', 'className'],
    div: ['class', 'className', 'style'],
    span: ['class', 'className', 'style'],
    h1: ['class', 'className', 'style'],
    h2: ['class', 'className', 'style'],
    h3: ['class', 'className', 'style'],
    h4: ['class', 'className', 'style'],
    h5: ['class', 'className', 'style'],
    h6: ['class', 'className', 'style'],
    p: ['class', 'className', 'style'],
  },

  protocols: {
    ...defaultSchema.protocols,

    // Required for Word → Pandoc embedded images
    src: ['http', 'https', 'data'],
  },
};

const allowedImageProtocols = new Set(['http:', 'https:', 'data:']);
const allowedLinkProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const urlTransform = (url: string, key: string, node: any) => {
  if (!url) return url;

  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('wiki:')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (key === 'src') {
      return allowedImageProtocols.has(parsed.protocol) ? url : '';
    }
    if (key === 'href') {
      return allowedLinkProtocols.has(parsed.protocol) ? url : '';
    }
    return url;
  } catch {
    return url;
  }
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const router = useRouter();
  const normalizedContent = useMemo(() => {
    if (!content) return '';

    // Normalize escaped newlines (if content passed through JSON/string layers)
    return content.replace(/\\n/g, '\n');
  }, [content]);

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMentions]}
        rehypePlugins={[
          rehypeRaw,
          rehypeFixColgroupWhitespace,
          [rehypeSanitize, sanitizeSchema],
        ]}
        urlTransform={urlTransform}
        components={{
          pre({ children }) {
            if (React.isValidElement(children)) {
              const className = (children.props as any)?.className || '';
              if (className.includes('language-mermaid') || className.includes('language-mindmap') || className.includes('language-markmap')) {
                return <div className="not-prose">{children}</div>;
              }
            }
            return <pre>{children}</pre>;
          },
          code({ className, children }) {
            let language = (className || '').replace('language-', '');
            if (language === 'shell' || language === 'sh' || language === 'console') language = 'bash';
            if (language === 'yml') language = 'yaml';
            if (language === 'mermaid') {
              return <MermaidBlock code={String(children || '')} />;
            }
            if (language === 'mindmap' || language === 'markmap') {
              return <MindmapBlock markdown={String(children || '')} />;
            }
            if (language) {
              const grammar = (Prism.languages as any)[language];
              let raw = String(children || '');
              if (language === 'json') {
                try {
                  const parsed = JSON.parse(raw);
                  raw = JSON.stringify(parsed, null, 2);
                } catch {
                  // keep original if it's not valid JSON
                }
              }
              if (grammar) {
                const html = Prism.highlight(raw, grammar, language);
                return (
                  <pre className={`language-${language}`}>
                    <code
                      className={`language-${language}`}
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  </pre>
                );
              }
            }
            return (
              <code className={className}>
                {children}
              </code>
            );
          },
          a({ href = '', children, ...props }) {
            return (
              <a
                {...props}
                href={href}
                onClick={(e) => {
                  if (!href) return;
                  try {
                    const targetUrl = new URL(href, window.location.origin);
                    if (targetUrl.origin === window.location.origin) {
                      e.preventDefault();
                      router.push(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
                    }
                  } catch {
                    // fall back to default navigation
                  }
                }}
              >
                {children}
              </a>
            );
          },
          img({ src, alt, ...props }) {
            // 👇 prevent <img src="">
            if (!src) return null;

            return (
              <img
                src={src}
                alt={alt ?? ""}
                {...props}
              />
            );
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );  
}

const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(svg);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Mermaid render failed.');
        }
      }
    };
    if (code.trim()) render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="text-xs text-amber-600 border border-amber-100 bg-amber-50 rounded-xl p-3">
        Mermaid render error: {error}
      </div>
    );
  }
  if (!svg) {
    return <div className="text-xs text-slate-400">Rendering diagram...</div>;
  }
  return <div className="mermaid-render" dangerouslySetInnerHTML={{ __html: svg }} />;
};

const MindmapBlock: React.FC<{ markdown: string }> = ({ markdown }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasMap, setHasMap] = useState(false);
  const mmRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    const render = async () => {
      if (!containerRef.current) return;
      try {
        const { Transformer } = await import('markmap-lib');
        const { Markmap } = await import('markmap-view');
        const transformer = new Transformer();
        const { root } = transformer.transform(markdown);
        containerRef.current.innerHTML = '';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', 'width: 100%; height: auto; font-size: 14px; background: transparent;');
        containerRef.current.appendChild(svg);
        const mm = Markmap.create(svg, { autoFit: true, fitRatio: 0.95, pan: true, scrollForPan: true, zoom: true }, root);
        mmRef.current = mm;
        svg.setAttribute('width', '100%');
        svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
        const rect = (mm as any).state?.rect;
        if (rect) {
          requestAnimationFrame(() => {
            const naturalHeight = rect.y2 - rect.y1;
            const height = Math.max(560, Math.ceil(naturalHeight * 1.4));
            svg.setAttribute('height', String(height));
            mm.fit?.();
            setHasMap(true);
          });
        }
        cleanup = () => {
          mmRef.current = null;
          mm?.destroy?.();
        };
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Mindmap render failed.');
      }
    };
    if (markdown.trim()) {
      render();
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, [markdown]);

  // Custom pan/zoom handling is wired inside render effect.

  if (error) {
    return (
      <div className="text-xs text-amber-600 border border-amber-100 bg-amber-50 rounded-xl p-3">
        Mindmap render error: {error}
      </div>
    );
  }

  return (
    <div
      className="mindmap-render border border-slate-200 rounded-2xl p-4 overflow-hidden relative"
      ref={containerRef}
      style={{
        backgroundColor: '#ffffff',
        backgroundImage:
          'radial-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
        boxShadow: 'none',
      }}
    >
      {hasMap && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const zoom = mmRef.current?.zoom;
              if (!zoom) return;
              mmRef.current?.svg?.call?.(zoom.scaleBy, 1.1);
            }}
            className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:shadow-sm transition-all flex items-center justify-center"
            title="Zoom in"
          >
            <i className="fas fa-plus text-xs"></i>
          </button>
          <button
            type="button"
            onClick={() => {
              const zoom = mmRef.current?.zoom;
              if (!zoom) return;
              mmRef.current?.svg?.call?.(zoom.scaleBy, 0.9);
            }}
            className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:shadow-sm transition-all flex items-center justify-center"
            title="Zoom out"
          >
            <i className="fas fa-minus text-xs"></i>
          </button>
          <button
            type="button"
            onClick={() => {
              mmRef.current?.fit?.();
            }}
            className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:shadow-sm transition-all flex items-center justify-center"
            title="Center diagram"
          >
            <i className="fas fa-crosshairs text-xs"></i>
          </button>
        </div>
      )}
    </div>
  );
};
