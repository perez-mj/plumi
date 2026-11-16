// src/lib/safeUrl.ts

/**
 * Whitelisted hosts for lesson video embeds.
 * Add/remove as your product requires.
 */
const ALLOWED_EMBED_HOSTS = new Set([
    import.meta.env.VITE_JITSI_DOMAIN,
    'meet.jit.si',
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'm.youtube.com',
    'player.vimeo.com',
    'vimeo.com',
    'loom.com',
    'www.loom.com',
    'drive.google.com',
    '8x8.vc',
]);

export function isSafeEmbedUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
        const host = u.hostname.toLowerCase();
        // Exact match OR subdomain of an allowed host
        if (ALLOWED_EMBED_HOSTS.has(host)) return true;
        for (const allowed of ALLOWED_EMBED_HOSTS) {
            if (host.endsWith('.' + allowed)) return true;
        }
        return false;
    } catch {
        return false;
    }
}

export function normalizeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    // Already an embed URL
    if (u.pathname.startsWith('/embed/')) {
      return url;
    }

    // youtube.com/watch?v=ID
    if (host === 'www.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }

    // youtu.be/ID
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    return url; // pass through non-YouTube URLs
  } catch {
    return null;
  }
}