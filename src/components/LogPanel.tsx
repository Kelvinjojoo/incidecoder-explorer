import { useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Terminal } from 'lucide-react';

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

interface LogPanelProps {
  logs: LogEntry[];
}

export function LogPanel({ logs }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-success';
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-warning';
      default:
        return 'text-muted-foreground';
    }
  };

  const getTypeBadge = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return <Badge className="bg-success/20 text-success border-0 text-[10px] px-1.5">OK</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-[10px] px-1.5">ERR</Badge>;
      case 'warning':
        return <Badge className="bg-warning/20 text-warning border-0 text-[10px] px-1.5">WARN</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-1.5">INFO</Badge>;
    }
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-md overflow-hidden">
      <div className="p-3 border-b border-border/50 flex items-center gap-2">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Activity Log</span>
        <Badge variant="outline" className="ml-auto font-mono text-xs">
          {logs.length}
        </Badge>
      </div>
      <ScrollArea className="h-[200px]" ref={scrollRef}>
        <div className="p-3 space-y-1 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Logs will appear here when scraping starts...
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2 py-1 animate-fade-in"
              >
                <span className="text-muted-foreground/60 shrink-0">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                {getTypeBadge(log.type)}
                <span className={getTypeColor(log.type)}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
