import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Card, CardContent } from './ui/card';
import { Player, Team } from '../App';
import { Check, X, Users } from 'lucide-react';

interface ActionFlowDialogsProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: 'free_throw' | 'foul' | 'turnover' | 'substitution' | null;
  selectedPlayer: Player | null;
  ourTeam: Team;
  opponentTeam: Team;
  onConfirm: (data: any) => void;
}

interface FreeThrowDialogProps {
  selectedPlayer: Player | null;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  onConfirm: () => void;
}

interface FoulDialogProps {
  selectedPlayer: Player | null;
  opponentTeam: Team;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  onConfirm: () => void;
}

interface TurnoverDialogProps {
  selectedPlayer: Player | null;
  opponentTeam: Team;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  onConfirm: () => void;
}

const FreeThrowDialog = React.memo(({ selectedPlayer, formData, setFormData, onClose, onConfirm }: FreeThrowDialogProps) => (
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Free Throws - {selectedPlayer?.name} #{selectedPlayer?.number}</DialogTitle>
      <DialogDescription>
        Record the free throw attempt(s)
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      <div>
        <Label>Number of Free Throws</Label>
        <div className="flex gap-2 mt-2">
          {[1, 2, 3].map(num => (
            <Button
              key={num}
              variant={formData.tripSize === num ? "default" : "outline"}
              onClick={() => setFormData(prev => ({ ...prev, tripSize: num, attempts: Array(num).fill(null) }))}
            >
              {num} FT{num > 1 ? 's' : ''}
            </Button>
          ))}
        </div>
      </div>

      {formData.tripSize && (
        <div>
          <Label>Mark Each Shot</Label>
          <div className="flex gap-2 mt-2">
            {Array(formData.tripSize).fill(null).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-1">
                <span className="text-sm text-muted-foreground">FT {index + 1}</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={formData.attempts?.[index] === true ? "default" : "outline"}
                    onClick={() => {
                      const newAttempts = [...(formData.attempts || [])];
                      newAttempts[index] = true;
                      setFormData(prev => ({ ...prev, attempts: newAttempts }));
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={formData.attempts?.[index] === false ? "destructive" : "outline"}
                    onClick={() => {
                      const newAttempts = [...(formData.attempts || [])];
                      newAttempts[index] = false;
                      setFormData(prev => ({ ...prev, attempts: newAttempts }));
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={onConfirm}
          disabled={!formData.tripSize || !formData.attempts?.every(a => a !== null)}
        >
          Record Free Throws
        </Button>
      </div>
    </div>
  </DialogContent>
));

FreeThrowDialog.displayName = 'FreeThrowDialog';

const FoulDialog = React.memo(({ selectedPlayer, opponentTeam, formData, setFormData, onClose, onConfirm }: FoulDialogProps) => (
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Foul Committed - {selectedPlayer?.name} #{selectedPlayer?.number}</DialogTitle>
      <DialogDescription>
        Record the foul details
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      <div>
        <Label>Foul Type</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            variant={formData.foulType === 'normal' ? "default" : "outline"}
            onClick={() => setFormData(prev => ({ ...prev, foulType: 'normal' }))}
          >
            Normal Foul
          </Button>
          <Button
            variant={formData.foulType === 'technical' ? "default" : "outline"}
            onClick={() => setFormData(prev => ({ ...prev, foulType: 'technical' }))}
          >
            Technical Foul
          </Button>
          <Button
            variant={formData.foulType === 'unsportsmanlike' ? "default" : "outline"}
            onClick={() => setFormData(prev => ({ ...prev, foulType: 'unsportsmanlike' }))}
            className="col-span-2"
          >
            Unsportsmanlike Foul
          </Button>
        </div>
      </div>

      {formData.foulType && formData.foulType !== 'technical' && (
        <div>
          <Label>Fouled Player</Label>
          <Select 
            value={formData.fouledPlayer || ''} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, fouledPlayer: value }))}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select opponent player" />
            </SelectTrigger>
            <SelectContent>
              {opponentTeam.players.map(player => (
                <SelectItem key={player.id} value={player.id}>
                  #{player.number} {player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Switch
          checked={formData.isOffensive || false}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isOffensive: checked }))}
        />
        <Label>Offensive Foul</Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={onConfirm}
          disabled={!formData.foulType || (formData.foulType !== 'technical' && !formData.fouledPlayer)}
        >
          Record Foul
        </Button>
      </div>
    </div>
  </DialogContent>
));

FoulDialog.displayName = 'FoulDialog';

const TurnoverDialog = React.memo(({ selectedPlayer, opponentTeam, formData, setFormData, onClose, onConfirm }: TurnoverDialogProps) => (
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Turnover - {selectedPlayer?.name} #{selectedPlayer?.number}</DialogTitle>
      <DialogDescription>
        Record the turnover details
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      <div>
        <Label>Turnover Type</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            variant={formData.turnoverType === 'bad_pass' ? "default" : "outline"}
            onClick={() => setFormData(prev => ({ ...prev, turnoverType: 'bad_pass' }))}
          >
            Bad Pass
          </Button>
          <Button
            variant={formData.turnoverType === 'lost_ball' ? "default" : "outline"}
            onClick={() => setFormData(prev => ({ ...prev, turnoverType: 'lost_ball' }))}
          >
            Lost Ball
          </Button>
          <Button
            variant={formData.turnoverType === 'traveling' ? "default" : "outline"}
            onClick={() => setFormData(prev => ({ ...prev, turnoverType: 'traveling' }))}
          >
            Traveling
          </Button>
          <Button
            variant={formData.turnoverType === 'double_dribble' ? "default" : "outline"}
            onClick={() => setFormData(prev => ({ ...prev, turnoverType: 'double_dribble' }))}
          >
            Double Dribble
          </Button>
          <Button
            variant={formData.turnoverType === 'offensive_foul' ? "default" : "outline"}
            onClick={() => setFormData(prev => ({ ...prev, turnoverType: 'offensive_foul' }))}
            className="col-span-2"
          >
            Offensive Foul
          </Button>
        </div>
      </div>

      <div>
        <Label>Stolen by (if applicable)</Label>
        <Select 
          value={formData.stolenBy || 'none'} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, stolenBy: value === 'none' ? null : value }))}
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Select player or none" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No steal - unforced turnover</SelectItem>
            <SelectItem value="team">Team steal (unknown player)</SelectItem>
            {opponentTeam.players.map(player => (
              <SelectItem key={player.id} value={player.id}>
                #{player.number} {player.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={onConfirm}
          disabled={!formData.turnoverType}
        >
          Record Turnover
        </Button>
      </div>
    </div>
  </DialogContent>
));

TurnoverDialog.displayName = 'TurnoverDialog';

const SubstitutionDialog = React.memo(({ ourTeam, onConfirm, onClose }: { ourTeam: Team; onConfirm: (data: any) => void; onClose: () => void; }) => {
  const [playersOut, setPlayersOut] = useState<Player[]>([]);
  const [playersIn, setPlayersIn] = useState<Player[]>([]);
  const [gameTime, setGameTime] = useState('');

  const availableToSub = ourTeam.players.filter(p => 
    !ourTeam.players.slice(0, 5).includes(p) // Not currently on court
  );

  const currentStarters = ourTeam.players.slice(0, 5); // Simplified

  const togglePlayerOut = (player: Player) => {
    if (playersOut.includes(player)) {
      setPlayersOut(prev => prev.filter(p => p.id !== player.id));
    } else {
      setPlayersOut(prev => [...prev, player]);
    }
  };

  const togglePlayerIn = (player: Player) => {
    if (playersIn.includes(player)) {
      setPlayersIn(prev => prev.filter(p => p.id !== player.id));
    } else {
      setPlayersIn(prev => [...prev, player]);
    }
  };

  const handleSubConfirm = () => {
    onConfirm({
      playersOut: playersOut.map(p => p.id),
      playersIn: playersIn.map(p => p.id),
      gameTime
    });
    setPlayersOut([]);
    setPlayersIn([]);
    setGameTime('');
    onClose();
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Player Substitution
        </DialogTitle>
        <DialogDescription>
          Select players going out and coming in. Must maintain 5 players on court.
        </DialogDescription>
      </DialogHeader>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Players Going Out */}
        <div>
          <h4 className="font-medium mb-3">Players Out</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {currentStarters.map(player => (
              <Card 
                key={player.id}
                className={`cursor-pointer transition-all ${
                  playersOut.includes(player) ? 'ring-2 ring-destructive' : ''
                }`}
                onClick={() => togglePlayerOut(player)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      {player.number}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{player.name}</div>
                      <div className="text-xs text-muted-foreground">{player.position}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-2">
            <Badge variant="destructive">
              {playersOut.length} selected
            </Badge>
          </div>
        </div>

        {/* Players Coming In */}
        <div>
          <h4 className="font-medium mb-3">Players In</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableToSub.map(player => (
              <Card 
                key={player.id}
                className={`cursor-pointer transition-all ${
                  playersIn.includes(player) ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => togglePlayerIn(player)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      {player.number}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{player.name}</div>
                      <div className="text-xs text-muted-foreground">{player.position}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-2">
            <Badge variant="default">
              {playersIn.length} selected
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Game Time (mm:ss)</Label>
        <Input
          type="text"
          placeholder="10:30"
          value={gameTime}
          onChange={(e) => setGameTime(e.target.value)}
          pattern="[0-9]{1,2}:[0-5][0-9]"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {playersOut.length === playersIn.length && playersOut.length > 0 
            ? `✓ ${playersOut.length} for ${playersIn.length} substitution valid`
            : '⚠ Must select equal numbers of players in and out'
          }
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubConfirm}
            disabled={playersOut.length !== playersIn.length || playersOut.length === 0 || !gameTime}
          >
            Confirm Substitution
          </Button>
        </div>
      </div>
    </DialogContent>
  );
});

SubstitutionDialog.displayName = 'SubstitutionDialog';

export function ActionFlowDialogs({ 
  isOpen, 
  onClose, 
  actionType, 
  selectedPlayer, 
  ourTeam, 
  opponentTeam, 
  onConfirm 
}: ActionFlowDialogsProps) {
  const [formData, setFormData] = useState<any>({});

  const resetForm = useCallback(() => {
    setFormData({});
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleConfirm = useCallback(() => {
    onConfirm(formData);
    resetForm();
    onClose();
  }, [onConfirm, formData, resetForm, onClose]);

  if (!isOpen || !actionType) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      {actionType === 'free_throw' && (
        <FreeThrowDialog
          selectedPlayer={selectedPlayer}
          formData={formData}
          setFormData={setFormData}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      )}
      {actionType === 'foul' && (
        <FoulDialog
          selectedPlayer={selectedPlayer}
          opponentTeam={opponentTeam}
          formData={formData}
          setFormData={setFormData}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      )}
      {actionType === 'turnover' && (
        <TurnoverDialog
          selectedPlayer={selectedPlayer}
          opponentTeam={opponentTeam}
          formData={formData}
          setFormData={setFormData}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      )}
      {actionType === 'substitution' && (
        <SubstitutionDialog
          ourTeam={ourTeam}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}