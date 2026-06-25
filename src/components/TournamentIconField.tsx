import React, { useCallback, useId, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { TournamentBadge } from './TournamentBadge';
import { TournamentLogoEditorDialog } from './TournamentLogoEditorDialog';
import {
  readTeamIconFile,
  TEAM_ICON_ACCEPT,
} from '../utils/tournamentIcon';
import { uploadEntityIcon } from '../lib/teamAssetStorage';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import { Pencil, Upload, X } from 'lucide-react';

interface TournamentIconFieldProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
  tournamentName?: string;
  tournamentId?: string;
}

export function TournamentIconField({
  value,
  onChange,
  tournamentName = 'Tournament',
  tournamentId,
}: TournamentIconFieldProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSource, setEditorSource] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const previewTournament = {
    name: tournamentName,
    icon: value,
  };

  const openEditor = useCallback((source: string) => {
    setEditorSource(source);
    setEditorOpen(true);
    setError(null);
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      try {
        setError(null);
        const dataUrl = await readTeamIconFile(file);
        openEditor(dataUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load image.');
      }
    },
    [openEditor]
  );

  const applyUrl = useCallback(() => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    setUrlDraft('');
    openEditor(trimmed);
  }, [urlDraft, openEditor]);

  const handleEditorApply = useCallback(
    async (processedDataUrl: string) => {
      setError(null);
      setUploading(true);
      try {
        if (tournamentId && isSupabaseConfigured) {
          const publicUrl = await uploadEntityIcon(
            requireSupabase(),
            'tournaments',
            tournamentId,
            processedDataUrl
          );
          onChange(publicUrl);
        } else {
          onChange(processedDataUrl);
        }
        setEditorOpen(false);
        setEditorSource(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not upload logo.');
      } finally {
        setUploading(false);
      }
    },
    [onChange, tournamentId]
  );

  const handleEditorCancel = useCallback(() => {
    setEditorOpen(false);
    setEditorSource(null);
  }, []);

  return (
    <>
      <div className="space-y-3">
        <Label>Tournament logo</Label>
        <div className="flex items-start gap-4">
          <TournamentBadge
            tournament={previewTournament}
            tournamentId={tournamentId}
            size="preview"
          />
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <label htmlFor={inputId} className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload image
                </label>
              </Button>
              {value && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEditor(value)}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit logo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      onChange(undefined);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </>
              )}
            </div>
            <input
              id={inputId}
              type="file"
              accept={TEAM_ICON_ACCEPT}
              className="sr-only"
              onChange={handleFileChange}
            />
            <div className="flex gap-2">
              <Input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="Or paste image URL"
                className="text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={applyUrl}
                disabled={!urlDraft.trim()}
              >
                Use URL
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WebP, or SVG up to 512 KB. Background is removed and the logo is trimmed before saving to cloud storage.
            </p>
            {uploading && (
              <p className="text-xs text-muted-foreground">Uploading logo…</p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
      </div>

      <TournamentLogoEditorDialog
        open={editorOpen}
        sourceDataUrl={editorSource}
        tournamentName={tournamentName}
        tournamentId={tournamentId}
        onApply={handleEditorApply}
        onCancel={handleEditorCancel}
      />
    </>
  );
}
