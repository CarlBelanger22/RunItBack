import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { LiveCourtOverlayShell } from './LiveCourtOverlayShell';

interface ShotOutcomeOverlayProps {
  isThree: boolean;
  isPaint: boolean;
  onMake: () => void;
  onMiss: () => void;
  onBlock: () => void;
  onCancel: () => void;
}

export function ShotOutcomeOverlay({
  isThree,
  isPaint,
  onMake,
  onMiss,
  onBlock,
  onCancel,
}: ShotOutcomeOverlayProps) {
  return (
    <LiveCourtOverlayShell>
      <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-center text-base">
            {isThree ? '3PT' : '2PT'}
            {isPaint ? ' · Paint' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 pb-4">
            <Button
              type="button"
              className="live-btn-make h-12 font-bold"
              onClick={(e) => {
                e.stopPropagation();
                onMake();
              }}
            >
              MAKE
            </Button>
            <Button
              type="button"
              className="live-btn-miss h-12 font-bold"
              onClick={(e) => {
                e.stopPropagation();
                onMiss();
              }}
            >
              MISS
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-12 font-bold"
              onClick={(e) => {
                e.stopPropagation();
                onBlock();
              }}
            >
              BLOCK
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="col-span-3"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              Cancel
            </Button>
        </CardContent>
      </Card>
    </LiveCourtOverlayShell>
  );
}
