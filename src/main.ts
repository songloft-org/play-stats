/// <reference types="@songloft/plugin-sdk" />
import { createRouter } from '@songloft/plugin-sdk';
import type { HTTPRequest, HTTPResponse, PlayEvent } from '@songloft/plugin-sdk';
import { registerStatsHandlers } from './handlers/stats';
import { appendRecord, drainWrites } from './stats/store';

const router = createRouter();
registerStatsHandlers(router);

// ── 去重机制：同一首歌至少间隔 duration 50%（最低 10s）才记录 ─────────────────
const MIN_DEDUP_MS = 10_000;
const lastRecorded = new Map<number, { timestamp: number; duration: number }>();

async function getSongDuration(songId: number): Promise<number> {
  try {
    const song = await songloft.songs.getById(songId);
    return song?.duration ?? 0;
  } catch {
    return 0;
  }
}

async function isDuplicate(songId: number, timestamp: number): Promise<boolean> {
  const prev = lastRecorded.get(songId);
  if (prev !== undefined) {
    const timeDiff = Math.abs(timestamp - prev.timestamp);
    // 动态窗口：取 max(10s, duration * 50%)
    const windowMs = prev.duration > 0
      ? Math.max(MIN_DEDUP_MS, prev.duration * 500)
      : MIN_DEDUP_MS;
    if (timeDiff < windowMs) {
      songloft.log.info(`[去重] songId=${songId} 间隔${timeDiff}ms < 窗口${windowMs}ms`);
      return true;
    }
  }
  const duration = await getSongDuration(songId);
  lastRecorded.set(songId, { timestamp, duration });
  // 清理过期条目，防止内存泄漏
  if (lastRecorded.size > 200) {
    const cutoff = Date.now() - MIN_DEDUP_MS * 2;
    for (const [id, v] of lastRecorded) {
      if (v.timestamp < cutoff) lastRecorded.delete(id);
    }
  }
  return false;
}

function subscribePlayEvents(): void {
  songloft.events.onPlayEvent(async (event: PlayEvent) => {
    songloft.log.info(
      `[PlayEvent] type=${event.type} source=${event.source} songId=${event.song.id} ${event.song.artist} - ${event.song.title}`,
    );
    
    // 只记录 finish 事件（播放完成），跳过 play 和 skip 事件
    if (event.type !== 'finish') {
      return;
    }
    
    // 同一首歌至少间隔 duration 50% 才算有效播放
    if (await isDuplicate(event.song.id, event.timestamp)) {
      return;
    }
    try {
      await appendRecord(event);
      songloft.log.info(
        `[已记录] type=${event.type} source=${event.source} ${event.song.artist} - ${event.song.title}`,
      );
    } catch (e) {
      songloft.log.error('记录播放失败: ' + String(e));
    }
  });
  songloft.log.info('[PlayEvent] 播放事件订阅已注册');
}

async function onInit(): Promise<void> {
  songloft.log.info('播放统计插件已启动');
  subscribePlayEvents();
}

async function onDeinit(): Promise<void> {
  songloft.events.offPlayEvent();
  await drainWrites();
  songloft.log.info('播放统计插件已停止');
}

async function onHTTPRequest(req: HTTPRequest): Promise<HTTPResponse> {
  return await router.handle(req);
}

globalThis.onInit = onInit;
globalThis.onDeinit = onDeinit;
globalThis.onHTTPRequest = onHTTPRequest;
