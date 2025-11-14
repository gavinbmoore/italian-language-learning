import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertTriangle, Lightbulb } from 'lucide-react';

// Import types from server schema
interface TableContent {
  headers: string[];
  rows: string[][];
}

interface RuleBlock {
  type: 'heading' | 'paragraph' | 'list' | 'note' | 'table';
  content: string | string[] | TableContent;
  level?: number;
  variant?: 'info' | 'warning' | 'tip';
  ordered?: boolean;
}

interface GrammarRulesRendererProps {
  rules: RuleBlock[] | string;
}

export function GrammarRulesRenderer({ rules }: GrammarRulesRendererProps) {
  // Handle legacy string format for backward compatibility
  if (typeof rules === 'string') {
    return (
      <div className="prose prose-sm max-w-none text-foreground">
        {rules.split('\n').map((paragraph, idx) => (
          <p key={idx} className="mb-3 last:mb-0 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  // Handle structured format
  if (!Array.isArray(rules)) {
    return null;
  }

  return (
    <div className="space-y-4">
      {rules.map((block, idx) => (
        <RuleBlockRenderer key={idx} block={block} />
      ))}
    </div>
  );
}

function RuleBlockRenderer({ block }: { block: RuleBlock }) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock content={block.content as string} level={block.level || 3} />;
    
    case 'paragraph':
      return <ParagraphBlock content={block.content as string} />;
    
    case 'list':
      return <ListBlock items={block.content as string[]} ordered={block.ordered || false} />;
    
    case 'note':
      return <NoteBlock content={block.content as string} variant={block.variant || 'info'} />;
    
    case 'table':
      return <TableBlock data={block.content as TableContent} />;
    
    default:
      return null;
  }
}

function HeadingBlock({ content, level }: { content: string; level: number }) {
  const className = "font-bold text-foreground";
  
  switch (level) {
    case 2:
      return <h2 className={`text-xl ${className} mb-3`}>{content}</h2>;
    case 3:
      return <h3 className={`text-lg ${className} mb-2`}>{content}</h3>;
    case 4:
      return <h4 className={`text-base ${className} mb-2`}>{content}</h4>;
    default:
      return <h3 className={`text-lg ${className} mb-2`}>{content}</h3>;
  }
}

function ParagraphBlock({ content }: { content: string }) {
  return (
    <p className="text-foreground leading-relaxed">
      {content}
    </p>
  );
}

function ListBlock({ items, ordered }: { items: string[]; ordered: boolean }) {
  const ListTag = ordered ? 'ol' : 'ul';
  const listClassName = ordered 
    ? "list-decimal list-inside space-y-2 pl-2" 
    : "list-disc list-inside space-y-2 pl-2";

  return (
    <ListTag className={listClassName}>
      {items.map((item, idx) => (
        <li key={idx} className="text-foreground leading-relaxed pl-2">
          <span className="ml-2">{item}</span>
        </li>
      ))}
    </ListTag>
  );
}

function NoteBlock({ content, variant }: { content: string; variant: 'info' | 'warning' | 'tip' }) {
  const variantConfig = {
    info: {
      className: 'border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800',
      icon: Info,
      iconClassName: 'text-blue-600 dark:text-blue-400',
    },
    warning: {
      className: 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800',
      icon: AlertTriangle,
      iconClassName: 'text-amber-600 dark:text-amber-400',
    },
    tip: {
      className: 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800',
      icon: Lightbulb,
      iconClassName: 'text-green-600 dark:text-green-400',
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Alert className={config.className}>
      <Icon className={`h-4 w-4 ${config.iconClassName}`} />
      <AlertDescription className="ml-2 text-foreground">
        {content}
      </AlertDescription>
    </Alert>
  );
}

function TableBlock({ data }: { data: TableContent }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {data.headers.map((header, idx) => (
              <th 
                key={idx} 
                className="px-4 py-2 text-left font-semibold text-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr 
              key={rowIdx} 
              className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              {row.map((cell, cellIdx) => (
                <td 
                  key={cellIdx} 
                  className="px-4 py-2 text-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

