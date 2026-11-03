// src/composables/useRealtimeChannel.ts
import { onBeforeUnmount, ref } from 'vue';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface ChannelHandle {
  /** The underlying channel. Register `.on(...)` handlers on this BEFORE calling `connect()`. */
  channel: RealtimeChannel;
  /** Registers handlers, then calls `.subscribe()` and binds status/reconnect. */
  connect: () => void;
  /** Fires whenever the channel re-enters SUBSCRIBED (after the first). */
  onReconnect: (fn: () => void) => () => void;
}

export function useRealtimeChannel(name: string) {
  const channel = ref<RealtimeChannel | null>(null);
  const status = ref<RealtimeStatus>('idle');

  const reconnectHandlers = new Set<() => void>();
  let disposed = false;
  let hasSubscribedOnce = false;

  function dispose() {
    if (channel.value) {
      void channel.value.unsubscribe();
      channel.value = null;
    }
    status.value = 'idle';
  }

  function onReconnect(fn: () => void) {
    reconnectHandlers.add(fn);
    return () => reconnectHandlers.delete(fn);
  }

  /**
   * Creates an UNSUSBCRIBED channel. Callers must register `.on(...)`
   * handlers on `handle.channel`, then call `handle.connect()`.
   */
  function create(): ChannelHandle {
    dispose();
    if (disposed) throw new Error('[realtime] composable already disposed');

    const ch = supabase.channel(name);
    channel.value = ch;

    function connect() {
      status.value = 'connecting';
      ch.subscribe((s, err) => {
        if (s === 'SUBSCRIBED') {
          status.value = 'live';
          if (hasSubscribedOnce) {
            reconnectHandlers.forEach((fn) => {
              try { fn(); } catch (e) { console.error('[realtime] reconnect handler', e); }
            });
          }
          hasSubscribedOnce = true;
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          status.value = 'error';
        } else {
          status.value = 'connecting';
        }
        if (err) console.error(`[realtime:${name}]`, err);
      });
    }

    return { channel: ch, connect, onReconnect };
  }

  onBeforeUnmount(() => {
    disposed = true;
    dispose();
    reconnectHandlers.clear();
  });

  return { channel, status, create, dispose, onReconnect };
}

export function hasRow<T extends { id: string }>(list: T[], id: string): boolean {
  return list.some((row) => row.id === id);
}

export function toPayload<T>(p: RealtimePostgresChangesPayload<T>) {
  return { old: p.old as Partial<T>, new: p.new as T };
}