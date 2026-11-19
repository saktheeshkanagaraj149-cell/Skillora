/**
 * Finds one real, embeddable YouTube video for a lesson with the YouTube Data API v3.
 *
 * Free key: Google Cloud console -> enable "YouTube Data API v3" -> Credentials -> API key.
 * Quota: 10,000 units/day free; one search costs 100 units, so roughly 100 lessons per day.
 * Callers should skip lessons that already have a video so runs can resume the next day.
 */

export const hasYouTubeKey = () => Boolean(process.env.YOUTUBE_API_KEY);

/** Pulls the 11-char video id out of any common YouTube URL (or a bare id). */
export function parseYouTubeId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

const decode = (s) =>
  String(s || '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

export class QuotaError extends Error {}

async function search(query, duration) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '5',
    videoEmbeddable: 'true',
    safeSearch: 'strict',
    relevanceLanguage: process.env.YOUTUBE_LANGUAGE || 'en',
    videoDuration: duration, // 'medium' = 4-20 min: a focused lesson, not a 10-hour course dump
    key: process.env.YOUTUBE_API_KEY,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    const body = await res.text();
    if ((res.status === 403 || res.status === 429) && /quota/i.test(body)) throw new QuotaError('YouTube daily quota used up, run again tomorrow');
    throw new Error(`YouTube ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.items || []).filter((it) => it.id?.videoId);
}

/** Returns { youtubeId, title, channel } or null when nothing suitable was found / no key is set. */
export async function findVideo(query) {
  if (!hasYouTubeKey() || !query) return null;
  let items = await search(query, 'medium');
  if (!items.length) items = await search(query, 'any');
  const it = items[0];
  if (!it) return null;
  return { youtubeId: it.id.videoId, title: decode(it.snippet?.title).slice(0, 200), channel: decode(it.snippet?.channelTitle).slice(0, 120) };
}

/**
 * Fills `video` on every lesson of a path document that lacks one. Mutates the doc (caller saves).
 * Returns how many videos were added. Throws QuotaError when the daily quota runs out (already-found videos stay set).
 */
export async function fillVideos(path, domainName = '') {
  let added = 0;
  for (const step of path.steps) {
    if (step.video?.youtubeId) continue;
    const q = step.videoQuery || `${step.title} ${domainName} tutorial`;
    const v = await findVideo(q);
    if (v) {
      step.video = v;
      added++;
    }
  }
  return added;
}
