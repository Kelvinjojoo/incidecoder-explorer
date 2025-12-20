import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Pause, RotateCcw, Download, Loader2 } from 'lucide-react';

interface ScraperControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  productLimit: string;
  onProductLimitChange: (value: string) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onExport: () => void;
  hasData: boolean;
  progress: {
    current: number;
    total: number;
    phase: string;
  };
}

export function ScraperControls({
  isRunning,
  isPaused,
  productLimit,
  onProductLimitChange,
  onStart,
  onPause,
  onReset,
  onExport,
  hasData,
  progress,
}: ScraperControlsProps) {
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-md">
      <div className="space-y-6">
        {/* Controls Row */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="limit" className="text-sm font-medium mb-2 block">
              Products to scrape (leave empty for all)
            </Label>
            <Input
              id="limit"
              type="number"
              placeholder="No limit"
              value={productLimit}
              onChange={(e) => onProductLimitChange(e.target.value)}
              disabled={isRunning}
              className="bg-background/50 font-mono"
            />
          </div>

          <div className="flex gap-2">
            {!isRunning ? (
              <Button
                onClick={onStart}
                className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Scraping
              </Button>
            ) : (
              <Button
                onClick={onPause}
                variant="secondary"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
            )}

            <Button
              onClick={onReset}
              variant="outline"
              disabled={isRunning && !isPaused}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>

            <Button
              onClick={onExport}
              variant="outline"
              disabled={!hasData}
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Progress Section */}
        {(isRunning || progress.current > 0) && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                {isRunning && !isPaused && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                <span className="font-medium">{progress.phase}</span>
              </span>
              <span className="font-mono text-foreground">
                {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
              </span>
            </div>
            
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full gradient-primary transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
