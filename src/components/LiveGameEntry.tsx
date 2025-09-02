import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Game, GameEvent, Shot, Player } from '../App';
import { ActionFlowDialogs } from './ActionFlowDialogs';
import courtImage from 'figma:asset/f65163b731043f15b81c5eb0e3f3bccc76945c97.png';
import { 
  Users, 
  Undo, 
  Save, 
  Clock, 
  Target,
  Activity,
  Filter,
  Edit2,
  Trash2,
  Settings,
  Eye,
  EyeOff,
  SkipForward,
  UserMinus,
  UserPlus,
  RotateCcw
} from 'lucide-react';

interface LiveGameEntryProps {
  game: Game;
  onGameUpdate: (game: Game) => void;
  onGameComplete: (game: Game) => void;
}

type ActionType = 'shot' | 'free_throw' | 'foul' | 'turnover' | 'rebound' | 'substitution';
type ActionStep = 'player_select' | 'shot_type' | 'location' | 'details' | 'confirm';
type DialogActionType = 'free_throw' | 'foul' | 'turnover' | 'substitution';

interface ActionState {
  type: ActionType | null;
  step: ActionStep;
  selectedPlayer: Player | null;
  data: Record<string, any>;
  isVisible: boolean;
}

interface DialogState {
  isOpen: boolean;
  type: DialogActionType | null;
}

interface CourtPosition {
  x: number;
  y: number;
}

export function LiveGameEntry({ game, onGameUpdate, onGameComplete }: LiveGameEntryProps) {
  // Game state
  const [currentGame, setCurrentGame] = useState<Game>(game);
  const [actionState, setActionState] = useState<ActionState>({
    type: null,
    step: 'player_select',
    selectedPlayer: null,
    data: {},
    isVisible: false
  });
  
  // UI state
  const [showZones, setShowZones] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [undoStack, setUndoStack] = useState<GameEvent[]>([]);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false, type: null });
  const [awaitingRebound, setAwaitingRebound] = useState(false);
  
  // Court canvas ref
  const courtRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      
      switch (event.key.toLowerCase()) {
        case 'u':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleUndo();
          }
          break;
        case 's':
          if (actionState.selectedPlayer) {
            event.preventDefault();
            startAction('shot', actionState.selectedPlayer);
          }
          break;
        case 'f':
          if (actionState.selectedPlayer) {
            event.preventDefault();
            openDialog('free_throw');
          }
          break;
        case 'p':
          if (actionState.selectedPlayer) {
            event.preventDefault();
            openDialog('foul');
          }
          break;
        case 't':
          if (actionState.selectedPlayer) {
            event.preventDefault();
            openDialog('turnover');
          }
          break;
        case 'r':
          event.preventDefault();
          startAction('rebound');
          break;
        case 'escape':
          event.preventDefault();
          resetAction();
          closeDialog();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [actionState.selectedPlayer, undoStack.length]);

  // Get current teams and players
  const isTrackingHome = true; // For now, assume we're tracking home team
  const ourTeam = currentGame.homeTeam;
  const opponentTeam = currentGame.awayTeam;
  const ourScore = currentGame.teamStats.home.total_points;
  const opponentScore = currentGame.teamStats.away.total_points;

  // Get current starters (simplified for now)
  const currentStarters = ourTeam.players.slice(0, 5);

  // Calculate team fouls for current quarter
  const currentQuarterFouls = currentGame.events
    .filter(e => e.period === currentGame.currentPeriod && e.type === 'foul')
    .length;

  // Get recent events for ledger
  const recentEvents = currentGame.events.slice(-8).reverse();

  // Format event for display
  const formatEvent = (event: GameEvent) => {
    const player = ourTeam.players.find(p => p.id === event.playerId);
    const playerName = player ? `${player.name} #${player.number}` : 'Unknown';
    
    switch (event.type) {
      case 'shot_attempt':
        const shot = currentGame.shots.find(s => s.timestamp === event.timestamp);
        if (shot) {
          return `${playerName} ${shot.made ? 'made' : 'missed'} ${shot.isThree ? '3' : '2'}PT shot`;
        }
        return `${playerName} shot attempt`;
      case 'free_throw':
        const made = event.details.attempts?.filter((a: boolean) => a).length || 0;
        const total = event.details.attempts?.length || 0;
        return `${playerName} ${made}/${total} FT`;
      case 'foul':
        return `${playerName} ${event.details.foulType || 'personal'} foul`;
      case 'turnover':
        return `${playerName} turnover (${event.details.turnoverType || 'general'})`;
      case 'substitution':
        return `Substitution at ${event.gameTime}`;
      default:
        return `${event.type} by ${playerName}`;
    }
  };

  // Action handlers
  const startAction = (type: ActionType, player?: Player) => {
    if (type === 'shot') {
      setActionState({
        type,
        step: player ? 'shot_type' : 'player_select',
        selectedPlayer: player || null,
        data: {},
        isVisible: true
      });
    } else if (['free_throw', 'foul', 'turnover', 'substitution'].includes(type)) {
      setDialogState({ isOpen: true, type: type as DialogActionType });
    }
  };

  const resetAction = () => {
    setActionState({
      type: null,
      step: 'player_select',
      selectedPlayer: null,
      data: {},
      isVisible: false
    });
    setAwaitingRebound(false);
  };

  const openDialog = (type: DialogActionType) => {
    setDialogState({ isOpen: true, type });
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, type: null });
  };

  const handleCourtTap = useCallback((event: React.MouseEvent) => {
    if (!courtRef.current || actionState.type !== 'shot') return;
    
    const rect = courtRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    // Determine if shot is in paint based on position (adjusted for real court proportions)
    const inPaint = x >= 35 && x <= 65 && y >= 65;
    
    // Determine if shot is beyond three-point line (rough estimation)
    const centerX = 50;
    const centerY = 85; // Basket position
    const distanceFromBasket = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    const isThreePoint = distanceFromBasket > 25; // Approximate three-point distance
    
    setActionState(prev => ({
      ...prev,
      step: 'details',
      data: { 
        ...prev.data, 
        x, 
        y, 
        inPaint,
        suggestedThreePoint: isThreePoint
      }
    }));
  }, [actionState.type]);

  const recordEvent = (eventData: Partial<GameEvent>) => {
    const event: GameEvent = {
      id: `event-${Date.now()}`,
      type: eventData.type || 'shot_attempt',
      timestamp: Date.now(),
      period: currentGame.currentPeriod,
      gameTime: currentGame.currentGameTime,
      teamId: ourTeam.id,
      playerId: actionState.selectedPlayer?.id,
      details: eventData.details || {},
      homeScore: ourScore,
      awayScore: opponentScore,
      ...eventData
    };

    const updatedGame = {
      ...currentGame,
      events: [...currentGame.events, event]
    };

    setCurrentGame(updatedGame);
    onGameUpdate(updatedGame);
    
    // Add to undo stack
    setUndoStack(prev => [...prev, event]);
    
    resetAction();
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const lastEvent = undoStack[undoStack.length - 1];
    const updatedGame = {
      ...currentGame,
      events: currentGame.events.filter(e => e.id !== lastEvent.id)
    };
    
    setCurrentGame(updatedGame);
    onGameUpdate(updatedGame);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const endPeriod = () => {
    const nextPeriod = currentGame.currentPeriod + 1;
    const updatedGame = {
      ...currentGame,
      currentPeriod: nextPeriod,
      currentGameTime: nextPeriod <= 4 ? '12:00' : '05:00' // OT is 5 minutes
    };
    
    setCurrentGame(updatedGame);
    onGameUpdate(updatedGame);
  };

  // Render player chip
  const PlayerChip = ({ player, isStarter = false }: { player: Player; isStarter?: boolean }) => {
    const playerFouls = currentGame.events
      .filter(e => e.playerId === player.id && e.type === 'foul' && e.period === currentGame.currentPeriod)
      .length;
    
    const playerPlusMinus = 0; // Calculate from game state
    
    return (
      <Card 
        className={`cursor-pointer transition-all hover:shadow-md ${
          actionState.selectedPlayer?.id === player.id ? 'ring-2 ring-primary' : ''
        } ${isStarter ? 'border-primary/50' : ''}`}
        onClick={() => setActionState(prev => ({ ...prev, selectedPlayer: player }))}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-medium">
              {player.number}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{player.name}</div>
              <div className="text-xs text-muted-foreground">{player.position}</div>
            </div>
          </div>
          {(playerFouls > 0 || playerPlusMinus !== 0) && (
            <div className="flex gap-1 mt-2">
              {playerFouls > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {playerFouls}F
                </Badge>
              )}
              {playerPlusMinus !== 0 && (
                <Badge variant={playerPlusMinus > 0 ? "default" : "secondary"} className="text-xs">
                  {playerPlusMinus > 0 ? '+' : ''}{playerPlusMinus}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render shot markers on court
  const ShotMarkers = () => {
    return (
      <>
        {currentGame.shots.map(shot => (
          <div
            key={shot.id}
            className={`absolute w-4 h-4 rounded-full transform -translate-x-1/2 -translate-y-1/2 border-2 shadow-lg ${
              shot.made 
                ? 'bg-green-500 border-green-600' 
                : 'bg-red-500 border-red-600'
            }`}
            style={{
              left: `${shot.x}%`,
              top: `${shot.y}%`
            }}
          >
            <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
              {shot.made ? '✓' : '×'}
            </div>
          </div>
        ))}
      </>
    );
  };

  // Render court zones overlay
  const CourtZones = () => {
    if (!showZones) return null;
    
    return (
      <div className="absolute inset-0 pointer-events-none">
        {/* Paint area highlight */}
        <div className="absolute bg-blue-500/15 border-2 border-blue-500/40 rounded-sm" 
             style={{ left: '35%', top: '65%', width: '30%', height: '35%' }} />
        {/* Three-point zone highlight */}
        <div className="absolute border-2 border-orange-500/40 rounded-full bg-orange-500/5"
             style={{ left: '10%', top: '20%', width: '80%', height: '60%' }} />
        {/* Mid-range zone */}
        <div className="absolute border border-green-500/30 bg-green-500/5"
             style={{ left: '25%', top: '45%', width: '50%', height: '30%' }} />
      </div>
    );
  };

  // Action pad component
  const ActionPad = () => {
    if (!actionState.isVisible || !actionState.selectedPlayer) return null;

    return (
      <Card className="mt-4 border-primary/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4" />
            Action: {actionState.selectedPlayer.name} #{actionState.selectedPlayer.number}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionState.step === 'shot_type' && (
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => setActionState(prev => ({ ...prev, step: 'location', data: { ...prev.data, isThree: false } }))}
                className="h-12"
              >
                2-Point Shot
              </Button>
              <Button 
                onClick={() => setActionState(prev => ({ ...prev, step: 'location', data: { ...prev.data, isThree: true } }))}
                className="h-12"
              >
                3-Point Shot
              </Button>
            </div>
          )}
          
          {actionState.step === 'location' && (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Tap the court to select shot location</p>
              <div className="text-xs text-muted-foreground">
                Selected shot type: {actionState.data.isThree ? '3-Point' : '2-Point'}
              </div>
              <Button variant="outline" onClick={resetAction}>
                Cancel
              </Button>
            </div>
          )}
          
          {actionState.step === 'details' && (
            <div className="space-y-4">
              {/* Shot location feedback */}
              <div className="text-sm bg-secondary/50 p-2 rounded">
                <div className="font-medium">Shot Location:</div>
                <div className="text-muted-foreground">
                  {actionState.data.isThree ? '3-Point' : '2-Point'} shot
                  {actionState.data.inPaint && ' in the paint'}
                  {actionState.data.suggestedThreePoint && !actionState.data.isThree && 
                    ' (appears to be from 3-point range)'}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Made Shot?</Label>
                <Switch 
                  checked={actionState.data.made || false}
                  onCheckedChange={(checked) => 
                    setActionState(prev => ({ ...prev, data: { ...prev.data, made: checked } }))
                  }
                />
              </div>
              
              {actionState.data.made && (
                <div className="space-y-2">
                  <Label>Assisted by?</Label>
                  <Select onValueChange={(value) => 
                    setActionState(prev => ({ ...prev, data: { ...prev.data, assistedBy: value === 'none' ? null : value } }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select player or none" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No assist</SelectItem>
                      {ourTeam.players
                        .filter(p => p.id !== actionState.selectedPlayer?.id)
                        .map(player => (
                          <SelectItem key={player.id} value={player.id}>
                            #{player.number} {player.name}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center justify-between">
                    <Label>Fastbreak?</Label>
                    <Switch 
                      checked={actionState.data.isTransition || false}
                      onCheckedChange={(checked) => 
                        setActionState(prev => ({ ...prev, data: { ...prev.data, isTransition: checked } }))
                      }
                    />
                  </div>
                </div>
              )}
              
              {!actionState.data.made && (
                <div className="space-y-2">
                  <Label>Blocked by?</Label>
                  <Select onValueChange={(value) => 
                    setActionState(prev => ({ ...prev, data: { ...prev.data, blockedBy: value === 'none' ? null : value } }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select opponent or none" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No block</SelectItem>
                      {opponentTeam.players.map(player => (
                        <SelectItem key={player.id} value={player.id}>
                          #{player.number} {player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    // Record the shot
                    const shot: Shot = {
                      id: `shot-${Date.now()}`,
                      playerId: actionState.selectedPlayer!.id,
                      x: actionState.data.x,
                      y: actionState.data.y,
                      made: actionState.data.made || false,
                      isThree: actionState.data.isThree,
                      timestamp: Date.now(),
                      assistedBy: actionState.data.assistedBy,
                      blockedBy: actionState.data.blockedBy,
                      isTransition: actionState.data.isTransition,
                      inPaint: actionState.data.inPaint,
                      period: currentGame.currentPeriod,
                      gameTime: currentGame.currentGameTime
                    };
                    
                    const updatedGame = {
                      ...currentGame,
                      shots: [...currentGame.shots, shot]
                    };
                    
                    setCurrentGame(updatedGame);
                    onGameUpdate(updatedGame);
                    
                    // If shot was missed, prompt for rebound
                    if (!actionState.data.made) {
                      setAwaitingRebound(true);
                    }
                    
                    resetAction();
                  }}
                  className="flex-1"
                >
                  Save Shot
                </Button>
                <Button variant="outline" onClick={resetAction}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Badge variant="outline" className="text-base px-3 py-1">
              {currentGame.currentPeriod <= 4 ? `Q${currentGame.currentPeriod}` : `OT${currentGame.currentPeriod - 4}`}
            </Badge>
            
            <div className="text-2xl font-bold">
              {ourScore} · {opponentScore}
            </div>
            
            <Badge variant="secondary" className="flex items-center gap-1">
              Team Fouls: {currentQuarterFouls}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
            >
              <Undo className="w-4 h-4 mr-1" />
              Undo
            </Button>
            
            <Button variant="outline" size="sm" onClick={endPeriod}>
              <SkipForward className="w-4 h-4 mr-1" />
              End Period
            </Button>
            
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Save className="w-3 h-3" />
              Auto-saved
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Pane Layout */}
      <div className="flex-1 flex">
        {/* Left Column - On-Court Players */}
        <div className="w-80 border-r p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">On Court</h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openDialog('substitution')}
            >
              <Users className="w-4 h-4 mr-1" />
              Sub
            </Button>
          </div>
          
          <div className="space-y-2">
            {currentStarters.map(player => (
              <PlayerChip key={player.id} player={player} isStarter />
            ))}
          </div>
          
          {/* Quick action buttons */}
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => startAction('shot')}
                disabled={!actionState.selectedPlayer}
                title="Keyboard shortcut: S"
              >
                Shot
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openDialog('free_throw')}
                disabled={!actionState.selectedPlayer}
                title="Keyboard shortcut: F"
              >
                Free Throw
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openDialog('foul')}
                disabled={!actionState.selectedPlayer}
                title="Keyboard shortcut: P"
              >
                Foul
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openDialog('turnover')}
                disabled={!actionState.selectedPlayer}
                title="Keyboard shortcut: T"
              >
                Turnover
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => startAction('rebound')}
                className={awaitingRebound ? 'ring-2 ring-orange-500' : ''}
                title="Keyboard shortcut: R"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Rebound
              </Button>
            </div>
            
            {/* Keyboard shortcuts help */}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <div className="font-medium mb-1">Keyboard Shortcuts:</div>
              <div className="space-y-1">
                <div>Ctrl+U: Undo</div>
                <div>S: Shot, F: Free Throw, P: Foul</div>
                <div>T: Turnover, R: Rebound</div>
                <div>Esc: Cancel action</div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column - Court + Action Pad */}
        <div className="flex-1 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Court View</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowZones(!showZones)}
            >
              {showZones ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              Zones
            </Button>
          </div>
          
          {/* Half Court */}
          <Card className="relative">
            <div 
              ref={courtRef}
              className="relative w-full aspect-[4/3] cursor-crosshair overflow-hidden bg-gray-100 dark:bg-gray-800"
              onClick={handleCourtTap}
            >
              {/* Basketball Court Image */}
              <img 
                src={courtImage}
                alt="Basketball half court"
                className="w-full h-full object-cover"
                draggable={false}
              />
              
              {/* Overlay elements */}
              <CourtZones />
              <ShotMarkers />
            </div>
          </Card>
          
          <ActionPad />
          
          {/* Rebound Prompt */}
          {awaitingRebound && (
            <Card className="border-orange-500 bg-orange-50 dark:bg-orange-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-orange-800 dark:text-orange-200">
                  Missed Shot - Record Rebound
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={() => {
                      // TODO: Open rebound dialog for offensive rebound
                      setAwaitingRebound(false);
                    }}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Offensive Rebound
                  </Button>
                  <Button 
                    onClick={() => {
                      // TODO: Open rebound dialog for defensive rebound
                      setAwaitingRebound(false);
                    }}
                    variant="outline"
                  >
                    Defensive Rebound
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setAwaitingRebound(false)}
                  className="w-full mt-2"
                >
                  Skip Rebound
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Ledger + History */}
        <div className="w-80 border-l p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Game Log</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryExpanded(!historyExpanded)}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Recent Events Ledger */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet</p>
              ) : (
                recentEvents.map(event => (
                  <div key={event.id} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50 hover:bg-muted/70 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${
                      event.type === 'shot_attempt' ? 'bg-green-500' :
                      event.type === 'foul' ? 'bg-red-500' :
                      event.type === 'turnover' ? 'bg-orange-500' :
                      event.type === 'free_throw' ? 'bg-blue-500' :
                      'bg-gray-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{formatEvent(event)}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{event.gameTime}</span>
                        <span>•</span>
                        <span>{event.period <= 4 ? `Q${event.period}` : `OT${event.period - 4}`}</span>
                        <span>•</span>
                        <span>{event.homeScore}-{event.awayScore}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="w-6 h-6 p-0 opacity-60 hover:opacity-100">
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Opponent Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Opponent Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-1 mb-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Add opponent points and create event
                    const updatedGame = {
                      ...currentGame,
                      teamStats: {
                        ...currentGame.teamStats,
                        away: {
                          ...currentGame.teamStats.away,
                          total_points: currentGame.teamStats.away.total_points + 1,
                          ft_made: currentGame.teamStats.away.ft_made + 1,
                          ft_attempted: currentGame.teamStats.away.ft_attempted + 1
                        }
                      }
                    };
                    setCurrentGame(updatedGame);
                    onGameUpdate(updatedGame);
                  }}
                >
                  +1
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const updatedGame = {
                      ...currentGame,
                      teamStats: {
                        ...currentGame.teamStats,
                        away: {
                          ...currentGame.teamStats.away,
                          total_points: currentGame.teamStats.away.total_points + 2,
                          fg_made: currentGame.teamStats.away.fg_made + 1,
                          fg_attempted: currentGame.teamStats.away.fg_attempted + 1,
                          two_made: currentGame.teamStats.away.two_made + 1,
                          two_attempted: currentGame.teamStats.away.two_attempted + 1
                        }
                      }
                    };
                    setCurrentGame(updatedGame);
                    onGameUpdate(updatedGame);
                  }}
                >
                  +2
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const updatedGame = {
                      ...currentGame,
                      teamStats: {
                        ...currentGame.teamStats,
                        away: {
                          ...currentGame.teamStats.away,
                          total_points: currentGame.teamStats.away.total_points + 3,
                          fg_made: currentGame.teamStats.away.fg_made + 1,
                          fg_attempted: currentGame.teamStats.away.fg_attempted + 1,
                          three_made: currentGame.teamStats.away.three_made + 1,
                          three_attempted: currentGame.teamStats.away.three_attempted + 1
                        }
                      }
                    };
                    setCurrentGame(updatedGame);
                    onGameUpdate(updatedGame);
                  }}
                >
                  +3
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1 mb-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Record opponent miss
                    const updatedGame = {
                      ...currentGame,
                      teamStats: {
                        ...currentGame.teamStats,
                        away: {
                          ...currentGame.teamStats.away,
                          fg_attempted: currentGame.teamStats.away.fg_attempted + 1,
                          two_attempted: currentGame.teamStats.away.two_attempted + 1
                        }
                      }
                    };
                    setCurrentGame(updatedGame);
                    onGameUpdate(updatedGame);
                    setAwaitingRebound(true); // Prompt for rebound
                  }}
                >
                  Miss 2
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const updatedGame = {
                      ...currentGame,
                      teamStats: {
                        ...currentGame.teamStats,
                        away: {
                          ...currentGame.teamStats.away,
                          fg_attempted: currentGame.teamStats.away.fg_attempted + 1,
                          three_attempted: currentGame.teamStats.away.three_attempted + 1
                        }
                      }
                    };
                    setCurrentGame(updatedGame);
                    onGameUpdate(updatedGame);
                    setAwaitingRebound(true);
                  }}
                >
                  Miss 3
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Increment opponent team fouls
                    const event: GameEvent = {
                      id: `foul-opp-${Date.now()}`,
                      type: 'foul',
                      timestamp: Date.now(),
                      period: currentGame.currentPeriod,
                      gameTime: currentGame.currentGameTime,
                      teamId: opponentTeam.id,
                      details: { type: 'normal' },
                      homeScore: ourScore,
                      awayScore: opponentScore
                    };
                    
                    const updatedGame = {
                      ...currentGame,
                      events: [...currentGame.events, event]
                    };
                    setCurrentGame(updatedGame);
                    onGameUpdate(updatedGame);
                  }}
                >
                  Opp Foul
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Record opponent turnover
                    const event: GameEvent = {
                      id: `to-opp-${Date.now()}`,
                      type: 'turnover',
                      timestamp: Date.now(),
                      period: currentGame.currentPeriod,
                      gameTime: currentGame.currentGameTime,
                      teamId: opponentTeam.id,
                      details: { type: 'general' },
                      homeScore: ourScore,
                      awayScore: opponentScore
                    };
                    
                    const updatedGame = {
                      ...currentGame,
                      events: [...currentGame.events, event]
                    };
                    setCurrentGame(updatedGame);
                    onGameUpdate(updatedGame);
                  }}
                >
                  Opp TO
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Flow Dialogs */}
      <ActionFlowDialogs
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        actionType={dialogState.type}
        selectedPlayer={actionState.selectedPlayer}
        ourTeam={ourTeam}
        opponentTeam={opponentTeam}
        onConfirm={(data) => {
          // Handle the confirmed action data
          console.log('Action confirmed:', dialogState.type, data);
          
          // Create appropriate event based on action type
          const eventData: Partial<GameEvent> = {
            type: dialogState.type === 'free_throw' ? 'free_throw' : 
                  dialogState.type === 'foul' ? 'foul' :
                  dialogState.type === 'turnover' ? 'turnover' : 'substitution',
            details: data
          };
          
          recordEvent(eventData);
        }}
      />
    </div>
  );
}