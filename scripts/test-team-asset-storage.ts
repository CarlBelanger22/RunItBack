/**
 * Unit tests for team/tournament icon Storage helpers.
 * Run: npm run test:team-asset-storage
 */

import {
  isIconDataUrl,
  isPersistedIconReference,
  parseIconDataUrl,
  teamAssetStoragePath,
} from '../src/utils/teamAssetStorage';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function testStoragePath(): void {
  assert(
    teamAssetStoragePath('teams', 'team-123') === 'teams/team-123.png',
    'team path'
  );
  assert(
    teamAssetStoragePath('tournaments', 'tournament-456') ===
      'tournaments/tournament-456.png',
    'tournament path'
  );
}

function testIconClassification(): void {
  assert(isIconDataUrl('data:image/png;base64,abc'), 'data url detected');
  assert(!isIconDataUrl('/team-logos/foo.png'), 'bundled path not data url');
  assert(
    isPersistedIconReference('https://example.com/storage/v1/object/public/team-assets/teams/x.png'),
    'storage https url'
  );
  assert(isPersistedIconReference('/team-logos/foo.png'), 'bundled path persisted');
  assert(!isPersistedIconReference('data:image/png;base64,abc'), 'data url not persisted ref');
  assert(!isPersistedIconReference('NTU'), 'abbrev not persisted ref');
}

function testParseDataUrl(): void {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const parsed = parseIconDataUrl(png);
  assert(parsed.mime === 'image/png', 'mime type');
  assert(parsed.bytes.length > 0, 'bytes decoded');
}

function main(): void {
  testStoragePath();
  testIconClassification();
  testParseDataUrl();
  console.log('All team asset storage tests passed.');
}

main();
