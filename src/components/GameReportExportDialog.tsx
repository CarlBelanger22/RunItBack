import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
  initialGameReportExportDialogState,
  resolveGameReportExportOptions,
  type GameReportExportMode,
  type GameReportExportOptions,
} from '../utils/gameReportModel';

export interface GameReportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasShotChartData: boolean;
  hasLineupData?: boolean;
  onDownload: (options: GameReportExportOptions) => void;
}

export function GameReportExportDialog({
  open,
  onOpenChange,
  hasShotChartData,
  hasLineupData = false,
  onDownload,
}: GameReportExportDialogProps) {
  const [mode, setMode] = useState<GameReportExportMode>('full');
  const [includeShotChart, setIncludeShotChart] = useState(false);
  const [includeComingSoon, setIncludeComingSoon] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = initialGameReportExportDialogState(hasShotChartData);
    setMode(initial.mode);
    setIncludeShotChart(initial.includeShotChart);
    setIncludeComingSoon(initial.includeComingSoonPlaceholders);
  }, [open, hasShotChartData]);

  const fullOptionsEnabled = mode === 'full';

  const handleDownload = () => {
    const options = resolveGameReportExportOptions({
      mode,
      includeShotChart,
      includeComingSoonPlaceholders: includeComingSoon,
      hasShotChartData,
    });
    onDownload(options);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100%-2rem,26rem)] max-w-[26rem] sm:max-w-[26rem]">
        <DialogHeader className="text-left sm:text-left">
          <DialogTitle>Export game report</DialogTitle>
          <DialogDescription>
            Choose a report style. PDFs are always portrait.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2.5">
            <Label className="text-sm font-medium">Report type</Label>
            <RadioGroup
              value={mode}
              onValueChange={(value) => setMode(value as GameReportExportMode)}
              className="gap-2.5"
            >
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="media" id="export-mode-media" className="mt-0.5" />
                <div className="min-w-0 grid gap-1">
                  <Label htmlFor="export-mode-media" className="font-medium cursor-pointer">
                    Media one-pager
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Scoreboard, leaders, and team comparison on one page.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="full" id="export-mode-full" className="mt-0.5" />
                <div className="min-w-0 grid gap-1">
                  <Label htmlFor="export-mode-full" className="font-medium cursor-pointer">
                    Full statistical report
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Box scores, comparison, and optional appendices.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div
            className={`space-y-3 ${fullOptionsEnabled ? '' : 'opacity-50'}`}
          >
            <Label className="text-sm font-medium">Full report options</Label>
            <div className="flex items-start gap-3">
              <Checkbox
                id="export-shot-chart"
                checked={includeShotChart}
                disabled={!fullOptionsEnabled || !hasShotChartData}
                onCheckedChange={(checked) =>
                  setIncludeShotChart(checked === true)
                }
              />
              <div className="min-w-0 grid gap-1">
                <Label
                  htmlFor="export-shot-chart"
                  className={`font-normal ${fullOptionsEnabled && hasShotChartData ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  Include shot chart
                </Label>
                <p className="text-xs text-muted-foreground">
                  {hasShotChartData
                    ? 'Half-court chart of located makes and misses.'
                    : 'No shot locations recorded for this game.'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="export-lineups"
                checked={includeComingSoon}
                disabled={!fullOptionsEnabled || !hasLineupData}
                onCheckedChange={(checked) =>
                  setIncludeComingSoon(checked === true)
                }
              />
              <div className="min-w-0 grid gap-1">
                <Label
                  htmlFor="export-lineups"
                  className={`font-normal ${
                    fullOptionsEnabled && hasLineupData
                      ? 'cursor-pointer'
                      : 'cursor-not-allowed'
                  }`}
                >
                  Include lineups
                </Label>
                <p className="text-xs text-muted-foreground">
                  {hasLineupData
                    ? 'Aggregated on-court lineups with minutes and +/-.'
                    : 'No lineup timeline for this game (live entry required).'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleDownload}>
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
