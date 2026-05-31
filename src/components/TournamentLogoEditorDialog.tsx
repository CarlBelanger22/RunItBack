import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { TournamentBadge } from './TournamentBadge';
import {
  processTeamIconWithSizeLimit,
  type TeamIconBgMode,
} from '../utils/teamIconNormalize';

const CHECKERBOARD_STYLE: React.CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
};

interface TournamentLogoEditorDialogProps {
  open: boolean;
  sourceDataUrl: string | null;
  tournamentName: string;
  tournamentId?: string;
  onApply: (processedDataUrl: string) => void;
  onCancel: () => void;
}

export function TournamentLogoEditorDialog({
  open,
  sourceDataUrl,
  tournamentName,
  tournamentId,
  onApply,
  onCancel,
}: TournamentLogoEditorDialogProps) {
  const [bgMode, setBgMode] = useState<TeamIconBgMode>('auto');
  const [paddingPx, setPaddingPx] = useState(0);
  const [processedDataUrl, setProcessedDataUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBgMode('auto');
    setPaddingPx(0);
    setProcessedDataUrl(null);
    setError(null);
  }, [open, sourceDataUrl]);

  useEffect(() => {
    if (!open || !sourceDataUrl) return;

    let cancelled = false;
    setProcessing(true);
    setError(null);

    processTeamIconWithSizeLimit(sourceDataUrl, { bgMode, paddingPx })
      .then((result) => {
        if (!cancelled) setProcessedDataUrl(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setProcessedDataUrl(null);
          setError(err instanceof Error ? err.message : 'Could not process logo.');
        }
      })
      .finally(() => {
        if (!cancelled) setProcessing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, sourceDataUrl, bgMode, paddingPx]);

  const previewTournament = useMemo(
    () => ({
      name: tournamentName,
      icon: processedDataUrl ?? undefined,
    }),
    [tournamentName, processedDataUrl]
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit tournament logo</DialogTitle>
          <DialogDescription>
            Remove the outer background and preview how the logo appears in the app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="mx-auto flex h-48 w-48 items-center justify-center overflow-hidden rounded-md border"
            style={CHECKERBOARD_STYLE}
          >
            {processedDataUrl ? (
              <img
                src={processedDataUrl}
                alt=""
                className="max-h-full max-w-full"
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <p className="text-xs text-muted-foreground px-4 text-center">
                {processing ? 'Processing…' : 'No preview available'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex flex-wrap gap-2">
              {(['auto', 'white', 'black'] as const).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={bgMode === mode ? 'default' : 'outline'}
                  onClick={() => setBgMode(mode)}
                >
                  {mode === 'auto' ? 'Auto' : mode === 'white' ? 'White' : 'Black'}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Flood-fill from image edges only. Interior dark details are kept.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Edge padding</Label>
              <span className="text-xs text-muted-foreground">{paddingPx}px</span>
            </div>
            <Slider
              min={0}
              max={8}
              step={1}
              value={[paddingPx]}
              onValueChange={(value) => setPaddingPx(value[0] ?? 0)}
            />
          </div>

          <div className="space-y-2">
            <Label>Badge preview</Label>
            <div className="flex items-end gap-4 rounded-md border p-3">
              <div className="text-center space-y-1">
                <TournamentBadge
                  tournament={previewTournament}
                  tournamentId={tournamentId}
                  size="md"
                />
                <p className="text-[10px] text-muted-foreground">List</p>
              </div>
              <div className="text-center space-y-1">
                <TournamentBadge
                  tournament={previewTournament}
                  tournamentId={tournamentId}
                  size="lg"
                />
                <p className="text-[10px] text-muted-foreground">Card</p>
              </div>
              <div className="text-center space-y-1">
                <TournamentBadge
                  tournament={previewTournament}
                  tournamentId={tournamentId}
                  size="hero"
                />
                <p className="text-[10px] text-muted-foreground">Header</p>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => processedDataUrl && onApply(processedDataUrl)}
            disabled={!processedDataUrl || processing}
          >
            Apply logo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
