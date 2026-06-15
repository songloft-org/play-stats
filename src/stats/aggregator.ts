import type { PlayRecord, StatsSummary } from './types';

function isValidRecord(r: PlayRecord): boolean {
  return (
    r != null &&
    typeof r.songId === 'number' &&
    typeof r.timestamp === 'number' &&
    typeof r.artist === 'string' && r.artist.length > 0 &&
    typeof r.title === 'string' && r.title.length > 0
  );
}

export function computeSummary(records: PlayRecord[]): StatsSummary {
  const artistMap = new Map<string, number>();
  const songMap = new Map<number, { title: string; artist: string; plays: number }>();
  const bySource: Record<string, number> = {};
  const uniqueSongs = new Set<number>();
  const uniqueArtists = new Set<string>();
  let totalDurationSec = 0;
  let validCount = 0;

  for (const r of records) {
    if (!isValidRecord(r)) continue;
    validCount++;

    uniqueSongs.add(r.songId);
    uniqueArtists.add(r.artist);
    totalDurationSec += r.duration || 0;

    artistMap.set(r.artist, (artistMap.get(r.artist) || 0) + 1);

    const existing = songMap.get(r.songId);
    if (existing) {
      existing.plays++;
    } else {
      songMap.set(r.songId, { title: r.title, artist: r.artist, plays: 1 });
    }

    const src = r.source || 'unknown';
    bySource[src] = (bySource[src] || 0) + 1;
  }

  const topArtists = [...artistMap.entries()]
    .map(([artist, plays]) => ({ artist, plays }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  const topSongs = [...songMap.entries()]
    .map(([songId, v]) => ({ songId, ...v }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  return {
    totalPlays: validCount,
    totalDurationSec,
    uniqueSongs: uniqueSongs.size,
    uniqueArtists: uniqueArtists.size,
    topArtists,
    topSongs,
    bySource,
  };
}
