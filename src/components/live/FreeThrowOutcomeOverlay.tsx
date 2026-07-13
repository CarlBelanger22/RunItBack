import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { LiveCourtOverlayShell } from './LiveCourtOverlayShell';

interface FreeThrowOutcomeOverlayProps {
  ftIndex: number;
  ftTotal: number;
  onMake: () => void;
  onMiss: () => void;
}

export function FreeThrowOutcomeOverlay({
  ftIndex,
  ftTotal,
  onMake,
  onMiss,
}: FreeThrowOutcomeOverlayProps) {
  return (
    <LiveCourtOverlayShell>
      <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-center text-base">
            FT {ftIndex} of {ftTotal}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 pb-4">
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
        </CardContent>
      </Card>
    </LiveCourtOverlayShell>
  );
}
