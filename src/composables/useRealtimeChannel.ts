import { onBeforeUnmount, ref } from 'vue';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'error';

export interface ChannelHandle {
  channel: RealtimeChannel;
  connect: () => void;
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

  function create(): ChannelHandle {
    dispose();

    if (disposed) {
      throw new Error('[realtime] composable already disposed');
    }

    const ch = supabase.channel(name);

    channel.value = ch;

    function connect() {
      status.value = 'connecting';

      ch.subscribe((subscriptionStatus, error) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          status.value = 'live';

          if (hasSubscribedOnce) {
            reconnectHandlers.forEach((handler) => {
              try {
                handler();
              } catch (handlerError) {
                console.error(
                  '[realtime] reconnect handler',
                  handlerError,
                );
              }
            });
          }

          hasSubscribedOnce = true;
        } else if (
          subscriptionStatus === 'CHANNEL_ERROR' ||
          subscriptionStatus === 'TIMED_OUT' ||
          subscriptionStatus === 'CLOSED'
        ) {
          status.value = 'error';
        } else {
          status.value = 'connecting';
        }

        if (error) {
          console.error(`[realtime:${name}]`, error);
        }
      });
    }

    return {
      channel: ch,
      connect,
      onReconnect,
    };
  }

  onBeforeUnmount(() => {
    disposed = true;
    dispose();
    reconnectHandlers.clear();
  });

  return {
    channel,
    status,
    create,
    dispose,
    onReconnect,
  };
}

export function hasRow<T extends { id: string }>(
  list: T[],
  id: string,
): boolean {
  return list.some((row) => row.id === id);
}

export function toPayload<T extends Record<string, unknown>>(
  payload: RealtimePostgresChangesPayload<T>,
) {
  return {
    old: payload.old as Partial<T>,
    new: payload.new as T,
  };
}