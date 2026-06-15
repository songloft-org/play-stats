import { jsonResponse, parseQuery } from '@songloft/plugin-sdk';
import type { Router } from '@songloft/plugin-sdk';
import { loadHistory } from '../stats/store';
import { computeSummary } from '../stats/aggregator';

const MAX_LIMIT = 100;

export function registerStatsHandlers(router: Router): void {
  router.get('/api/stats/summary', async () => {
    const history = await loadHistory();
    return jsonResponse({ success: true, data: computeSummary(history) });
  });

  router.get('/api/history', async (req) => {
    const q = parseQuery(req.query);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(q.limit || '30'), 10) || 30));
    const offset = Math.max(0, parseInt(String(q.offset || '0'), 10) || 0);

    const history = await loadHistory();
    // 从后往前取，按 songId 去重，显示最近 N 首不同的歌
    const seen = new Set<number>();
    const page: typeof history = [];
    let skipped = 0;
    for (let i = history.length - 1; i >= 0 && page.length < limit + offset; i--) {
      const songId = history[i].songId;
      if (seen.has(songId)) continue;
      seen.add(songId);
      if (skipped < offset) {
        skipped++;
        continue;
      }
      page.push(history[i]);
    }

    return jsonResponse({
      success: true,
      data: { total: history.length, records: page },
    });
  });
}
