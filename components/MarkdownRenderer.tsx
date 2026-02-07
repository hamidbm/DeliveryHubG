'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { visit } from 'unist-util-visit';

interface MarkdownRendererProps {
  content: string;
}

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
    ],

    table: ['class', 'style'],
    thead: ['class', 'style'],
    tbody: ['class', 'style'],
    tr: ['class', 'style'],
    th: ['class', 'style', 'colspan', 'rowspan'],
    td: ['class', 'style', 'colspan', 'rowspan'],
    col: ['span', 'width'],
    colgroup: ['span', 'width'],
    div: ['class', 'style'],
    span: ['class', 'style'],
  },

  protocols: {
    ...defaultSchema.protocols,

    // Required for Word → Pandoc embedded images
    src: ['http', 'https', 'data'],
  },
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const normalizedContent = useMemo(() => {
    if (!content) return '';

    // Normalize escaped newlines (if content passed through JSON/string layers)
    return content.replace(/\\n/g, '\n');
  }, [content]);

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeFixColgroupWhitespace,
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={{
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
