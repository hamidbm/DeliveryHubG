import React, { useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Diagnostic Log
  useEffect(() => {
    if (content) {
      console.log('Markdown Diagnostic:', {
        first200: content.substring(0, 200),
        hasEscapedNewline: content.includes('\\n'),
        hasRealNewline: content.includes('\n'),
        length: content.length
      });
    }
  }, [content]);

  // Normalization: Fix literal \n character sequences
  const normalizedContent = useMemo(() => {
    if (!content) return '';
    return content.replace(/\\n/g, '\n');
  }, [content]);

  // Configure sanitization to allow tables, images, and basic styles for dimensions
  const schema = useMemo(() => ({
    ...defaultSchema,
    tagNames: [
      ...(defaultSchema.tagNames || []),
      'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'div', 'span'
    ],
    attributes: {
      ...defaultSchema.attributes,
      img: [
        ...(defaultSchema.attributes?.img || []),
        'style', 'width', 'height'
      ],
      table: ['style', 'class', 'width'],
      td: ['style', 'class', 'colspan', 'rowspan'],
      th: ['style', 'class', 'colspan', 'rowspan'],
      div: ['style', 'class'],
      span: ['style', 'class']
    }
  }), []);

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;