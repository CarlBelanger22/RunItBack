import React, { useRef, useCallback, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Team } from '../../App';
import { normalizeHeightCmInput, normalizeWeightKgInput } from '../../lib/playerMeasurements';

interface PlayerFormProps {
  initialData?: {
    name?: string;
    number?: string;
    position?: string;
    secondaryPosition?: string;
    height?: string;
    weight?: string;
    dateOfBirth?: string;
  };
  selectedTeam: Team | null;
  positions: string[];
  isNumberTaken: (number: string, teamId: string) => boolean;
  onSubmit: (data: { 
    name: string; 
    number: string; 
    position: string;
    secondaryPosition?: string;
    height: string;
    weight: string;
    dateOfBirth?: string;
  }) => void;
  onCancel: () => void;
}

export const PlayerForm = React.memo(({
  initialData,
  selectedTeam,
  positions = ['PG', 'SG', 'SF', 'PF', 'C'],
  isNumberTaken,
  onSubmit,
  onCancel
}: PlayerFormProps) => {
  const nameRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const dateOfBirthRef = useRef<HTMLInputElement>(null);
  
  // Position needs state for Select component - ensure positions array is valid
  const validPositions = Array.isArray(positions) && positions.length > 0 ? positions : ['PG', 'SG', 'SF', 'PF', 'C'];
  
  // Ensure initial position is valid - if player's position doesn't exist in validPositions, use first valid position
  const getValidInitialPosition = () => {
    if (!initialData?.position) return validPositions[0] || '';
    return validPositions.includes(initialData.position) ? initialData.position : validPositions[0] || '';
  };
  
  const [position, setPosition] = useState<string>(getValidInitialPosition());
  const NONE_POSITION = 'none';
  const [secondaryPosition, setSecondaryPosition] = useState<string>(
    initialData?.secondaryPosition && validPositions.includes(initialData.secondaryPosition)
      ? initialData.secondaryPosition
      : NONE_POSITION
  );

  const handlePositionChange = useCallback((value: string) => {
    setPosition(value);
  }, []);

  const handleSecondaryPositionChange = useCallback((value: string) => {
    setSecondaryPosition(value);
  }, []);

  // Track number value for validation (only update on change, not during render)
  const [numberValue, setNumberValue] = useState<string>(initialData?.number || '');

  const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNumberValue(value);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const name = nameRef.current?.value || '';
    const number = numberRef.current?.value || '';
    const height = heightRef.current?.value || '';
    const weight = weightRef.current?.value || '';
    const dateOfBirth = dateOfBirthRef.current?.value || '';
    
    if (name.trim() && number.trim()) {
      onSubmit({ 
        name, 
        number, 
        position,
        secondaryPosition: secondaryPosition === NONE_POSITION ? undefined : secondaryPosition,
        height: normalizeHeightCmInput(height),
        weight: normalizeWeightKgInput(weight),
        dateOfBirth: dateOfBirth || undefined
      });
    }
  }, [onSubmit, position, secondaryPosition]);

  // Defensive check: ensure isNumberTaken function exists and selectedTeam is valid
  const numberTaken = selectedTeam && numberValue && isNumberTaken && selectedTeam.id
    ? isNumberTaken(numberValue, selectedTeam.id)
    : false;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" onKeyDown={(e) => {
      // Prevent form submission on Enter (only submit on button click)
      if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
        e.preventDefault();
      }
    }}>
      <div className="space-y-2">
        <Label htmlFor="playerName">Player Name</Label>
        <Input
          ref={nameRef}
          id="playerName"
          defaultValue={initialData?.name || ''}
          placeholder="Enter player name"
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="playerNumber">Jersey Number</Label>
          <Input
            ref={numberRef}
            id="playerNumber"
            type="number"
            min="0"
            max="99"
            defaultValue={initialData?.number || ''}
            placeholder="0-99"
            required
            onChange={handleNumberChange}
          />
          {numberTaken && (
            <p className="text-xs text-destructive">This number is already taken</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="playerPosition">Position</Label>
          <Select value={position} onValueChange={handlePositionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              {validPositions.map(pos => (
                <SelectItem key={pos} value={pos}>
                  {pos}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="playerSecondaryPosition">Secondary Position (Optional)</Label>
          <Select value={secondaryPosition} onValueChange={handleSecondaryPositionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select secondary position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_POSITION}>None</SelectItem>
              {validPositions.map(pos => (
                <SelectItem key={pos} value={pos}>
                  {pos}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="playerDateOfBirth">Date of Birth (Optional)</Label>
          <Input
            ref={dateOfBirthRef}
            id="playerDateOfBirth"
            type="date"
            defaultValue={initialData?.dateOfBirth || ''}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="playerHeight">Height (cm, optional)</Label>
          <Input
            ref={heightRef}
            id="playerHeight"
            type="number"
            inputMode="decimal"
            step="any"
            defaultValue={initialData?.height || ''}
            placeholder="e.g., 191"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="playerWeight">Weight (kg, optional)</Label>
          <Input
            ref={weightRef}
            id="playerWeight"
            type="number"
            inputMode="decimal"
            step="any"
            defaultValue={initialData?.weight || ''}
            placeholder="e.g., 88"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button 
          type="submit"
          disabled={numberTaken}
        >
          {initialData?.name ? 'Update Player' : 'Add Player'}
        </Button>
      </div>
    </form>
  );
});

PlayerForm.displayName = 'PlayerForm';
