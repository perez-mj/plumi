// src/composables/usePushNotifications.ts
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function usePushNotifications() {
  async function register() {
    if (!Capacitor.isNativePlatform()) return;

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[push] permission denied');
      return;
    }

    await PushNotifications.addListener('registration', async (token) => {
      const auth = useAuthStore();
      const userId = auth.user?.id;           // <-- was auth.profile?.id
      if (!userId) {
        console.warn('[push] no authenticated user; skipping token save');
        return;
      }

      const { error } = await supabase.from('user_devices').upsert(
        {
          user_id: userId,
          token: token.value,
          platform: Capacitor.getPlatform(),
        },
        { onConflict: 'token' },
      );
      if (error) console.error('[push] token save failed', error);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] registration error', err);
    });

    await PushNotifications.register();
  }

  return { register };
}