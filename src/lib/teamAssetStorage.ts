import type { SupabaseClient } from '@supabase/supabase-js';
import type { Team, Tournament } from '../App';
import {
  TEAM_ASSETS_BUCKET,
  iconDataUrlToBlob,
  isIconDataUrl,
  teamAssetStoragePath,
  type TeamAssetKind,
} from '../utils/teamAssetStorage';

export {
  TEAM_ASSETS_BUCKET,
  isIconDataUrl,
  isPersistedIconReference,
  normalizeIconForDb,
  teamAssetStoragePath,
  type TeamAssetKind,
} from '../utils/teamAssetStorage';

export async function uploadEntityIcon(
  client: SupabaseClient,
  kind: TeamAssetKind,
  entityId: string,
  dataUrl: string
): Promise<string> {
  const path = teamAssetStoragePath(kind, entityId);
  const blob = iconDataUrlToBlob(dataUrl);

  const { error } = await client.storage.from(TEAM_ASSETS_BUCKET).upload(path, blob, {
    contentType: 'image/png',
    upsert: true,
    cacheControl: '31536000',
  });

  if (error) {
    throw new Error(`icon upload (${kind}/${entityId}): ${error.message}`);
  }

  const { data } = client.storage.from(TEAM_ASSETS_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error(`icon upload (${kind}/${entityId}): missing public URL`);
  }

  return data.publicUrl;
}

export function getEntityIconPublicUrl(
  client: SupabaseClient,
  kind: TeamAssetKind,
  entityId: string
): string {
  const { data } = client.storage
    .from(TEAM_ASSETS_BUCKET)
    .getPublicUrl(teamAssetStoragePath(kind, entityId));
  return data.publicUrl;
}

export async function resolveEntityIconForCloud(
  client: SupabaseClient,
  kind: TeamAssetKind,
  entityId: string,
  icon: string | undefined
): Promise<string | undefined> {
  if (!icon?.trim()) return undefined;
  if (!isIconDataUrl(icon)) return icon.trim();
  return uploadEntityIcon(client, kind, entityId, icon);
}

export async function prepareIconsForCloudSave(
  client: SupabaseClient,
  teams: Team[],
  tournaments: Tournament[]
): Promise<{ teams: Team[]; tournaments: Tournament[] }> {
  const nextTeams = await Promise.all(
    teams.map(async (team) => {
      if (!isIconDataUrl(team.icon)) return team;
      const icon = await resolveEntityIconForCloud(
        client,
        'teams',
        team.id,
        team.icon
      );
      return { ...team, icon };
    })
  );

  const nextTournaments = await Promise.all(
    tournaments.map(async (tournament) => {
      if (!isIconDataUrl(tournament.icon)) return tournament;
      const icon = await resolveEntityIconForCloud(
        client,
        'tournaments',
        tournament.id,
        tournament.icon
      );
      return { ...tournament, icon };
    })
  );

  return { teams: nextTeams, tournaments: nextTournaments };
}
