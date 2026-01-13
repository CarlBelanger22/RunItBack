import React, { useRef, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface TeamFormProps {
  initialName?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export const TeamForm = React.memo(({
  initialName = '',
  onSubmit,
  onCancel,
  isEditing = false
}: TeamFormProps) => {
  const nameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const name = nameRef.current?.value || '';
    if (name.trim()) {
      onSubmit(name);
    }
  }, [onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4" onKeyDown={(e) => {
      // Prevent form submission on Enter (only submit on button click)
      if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
        e.preventDefault();
      }
    }}>
      <div className="space-y-2">
        <Label htmlFor="teamName">Team Name</Label>
        <Input
          ref={nameRef}
          id="teamName"
          defaultValue={initialName}
          placeholder="Enter team name"
          required
          autoFocus
        />
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
          {isEditing ? 'Update Team' : 'Create Team'}
        </Button>
      </div>
    </form>
  );
});

TeamForm.displayName = 'TeamForm';
