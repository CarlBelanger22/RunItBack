import React, { useRef, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Team } from '../../App';

interface TournamentFormProps {
  initialData?: {
    name?: string;
    description?: string;
    year?: number;
    month?: string;
    selectedTeams?: string[];
  };
  teams: Team[];
  onSubmit: (data: {
    name: string;
    description: string;
    year: number;
    month: string;
    teams: string[];
  }) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export const TournamentForm = React.memo(({
  initialData,
  teams,
  onSubmit,
  onCancel,
  isEditing = false
}: TournamentFormProps) => {
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  // Use state for month and teams (needed for Select and Checkbox components)
  // But these don't cause parent re-renders since form is extracted
  const [month, setMonth] = React.useState<string>(
    initialData?.month || new Date().toLocaleDateString('en-US', { month: 'short' })
  );
  const [selectedTeams, setSelectedTeams] = React.useState<Set<string>>(
    new Set(initialData?.selectedTeams || [])
  );

  const handleTeamToggleWithState = useCallback((teamId: string) => {
    setSelectedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  }, []);

  const handleMonthChange = useCallback((value: string) => {
    setMonth(value);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    // Read values from refs and state
    const tournamentData = {
      name: nameRef.current?.value || '',
      description: descriptionRef.current?.value || '',
      year: parseInt(yearRef.current?.value || String(new Date().getFullYear())) || new Date().getFullYear(),
      month: month,
      teams: Array.from(selectedTeams)
    };

    onSubmit(tournamentData);
  }, [onSubmit, month, selectedTeams]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4" onKeyDown={(e) => {
      // Prevent form submission on Enter (only submit on button click)
      if (e.key === 'Enter' && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
    }}>
      <div className="space-y-2">
        <Label htmlFor="name">Tournament Name</Label>
        <Input
          ref={nameRef}
          id="name"
          defaultValue={initialData?.name || ''}
          placeholder="Enter tournament name"
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          ref={descriptionRef}
          id="description"
          defaultValue={initialData?.description || ''}
          placeholder="Enter tournament description"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input
            ref={yearRef}
            id="year"
            type="number"
            defaultValue={initialData?.year || new Date().getFullYear()}
            min="2020"
            max="2030"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <Select 
            defaultValue={initialData?.month || new Date().toLocaleDateString('en-US', { month: 'short' })} 
            onValueChange={handleMonthChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                <SelectItem key={month} value={month}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Teams</Label>
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-2">
              No teams available. Create some teams first.
            </p>
          ) : (
            teams.map(team => (
              <div key={team.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`team-${team.id}`}
                  checked={selectedTeams.has(team.id)}
                  onCheckedChange={() => handleTeamToggleWithState(team.id)}
                />
                <Label 
                  htmlFor={`team-${team.id}`} 
                  className="text-sm cursor-pointer"
                >
                  {team.name}
                </Label>
              </div>
            ))
          )}
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
        <Button type="submit">
          {isEditing ? 'Update Tournament' : 'Create Tournament'}
        </Button>
      </div>
    </form>
  );
});

TournamentForm.displayName = 'TournamentForm';
