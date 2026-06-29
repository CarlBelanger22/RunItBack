import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

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
    <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-xl z-10 pointer-events-auto">
      <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-center text-base">
            {isThree ? '3PT' : '2PT'}
            {isPaint ? ' · Paint' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 pb-4">
          <Button
            className="h-12 bg-green-600 hover:bg-green-700 font-bold"
            onClick={(e) => {
              e.stopPropagation();
              onMake();
            }}
          >
            MAKE
          </Button>
          <Button
            variant="destructive"
            className="h-12 font-bold"
            onClick={(e) => {
              e.stopPropagation();
              onMiss();
            }}
          >
            MISS
          </Button>
          <Button
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
    </div>
  );
}
