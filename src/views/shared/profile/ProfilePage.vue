<!-- src/views/shared/profile/ProfilePage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">

        <!-- Profile header card -->
        <section class="profile__card">
          <div class="profile__avatar">
            <img v-if="form.avatarUrl" :src="form.avatarUrl" :alt="auth.displayName" />
            <span v-else>{{ initials }}</span>
          </div>
          <div class="profile__meta">
            <p class="profile__name">{{ auth.displayName }}</p>
            <p class="profile__email">{{ auth.user?.email }}</p>
            <p class="profile__role">{{ auth.role }}</p>
          </div>
        </section>

        <!-- Edit profile -->
        <section class="profile__form-card">
          <h2 class="profile__section-title">Edit Profile</h2>
          <form @submit.prevent="save" class="profile__form">
            <label>First name <input v-model="form.firstName" required /></label>
            <label>Last name <input v-model="form.lastName" required /></label>
            <label>Avatar URL <input v-model="form.avatarUrl" placeholder="https://…" /></label>

            <label>
              Bio
              <textarea
                v-model="form.bio"
                class="profile__bio"
                rows="3"
                :maxlength="BIO_MAX"
              />
            </label>
            <div class="profile__counter" :class="{ 'is-limit': form.bio.length >= BIO_MAX }">
              {{ form.bio.length }} / {{ BIO_MAX }}
            </div>

            <div class="profile__actions">
              <ion-button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</ion-button>
              <span v-if="savedMessage" class="profile__success">{{ savedMessage }}</span>
            </div>
            <p v-if="errorMessage" class="profile__error">{{ errorMessage }}</p>
          </form>
        </section>

        <!-- Change password -->
        <section class="profile__form-card">
          <h2 class="profile__section-title">Change Password</h2>
          <form @submit.prevent="changePassword" class="profile__form">

            <label>
              Current password
              <div class="pwd-field">
                <input
                  v-model="pwd.current"
                  :type="pwd.showCurrent ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  :disabled="pwd.saving"
                />
                <button type="button" class="pwd-toggle"
                  :aria-label="pwd.showCurrent ? 'Hide password' : 'Show password'"
                  @click="pwd.showCurrent = !pwd.showCurrent">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <template v-if="pwd.showCurrent">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </template>
                    <template v-else>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </template>
                  </svg>
                </button>
              </div>
            </label>

            <label>
              New password
              <div class="pwd-field">
                <input
                  v-model="pwd.next"
                  :type="pwd.showNext ? 'text' : 'password'"
                  required
                  autocomplete="new-password"
                  :disabled="pwd.saving"
                />
                <button type="button" class="pwd-toggle"
                  :aria-label="pwd.showNext ? 'Hide password' : 'Show password'"
                  @click="pwd.showNext = !pwd.showNext">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <template v-if="pwd.showNext">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </template>
                    <template v-else>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </template>
                  </svg>
                </button>
              </div>
            </label>

            <ul v-if="pwd.next.length > 0" class="pwd-policy">
              <li :class="{ 'is-met': policy.length }"><span class="pwd-policy__dot" />8+ characters</li>
              <li :class="{ 'is-met': policy.lower && policy.upper }"><span class="pwd-policy__dot" />Upper & lowercase</li>
              <li :class="{ 'is-met': policy.digit }"><span class="pwd-policy__dot" />A number</li>
              <li :class="{ 'is-met': policy.differs }"><span class="pwd-policy__dot" />Differs from current</li>
            </ul>

            <label>
              Confirm new password
              <div class="pwd-field">
                <input
                  v-model="pwd.confirm"
                  :type="pwd.showConfirm ? 'text' : 'password'"
                  required
                  autocomplete="new-password"
                  :disabled="pwd.saving"
                />
                <button type="button" class="pwd-toggle"
                  :aria-label="pwd.showConfirm ? 'Hide password' : 'Show password'"
                  @click="pwd.showConfirm = !pwd.showConfirm">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <template v-if="pwd.showConfirm">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </template>
                    <template v-else>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </template>
                  </svg>
                </button>
              </div>
            </label>

            <p v-if="pwd.confirm.length > 0 && pwd.next !== pwd.confirm" class="pwd-mismatch">
              Passwords don't match.
            </p>

            <div class="profile__actions">
              <ion-button type="submit" :disabled="pwd.saving || !policy.valid">
                {{ pwd.saving ? 'Updating…' : 'Update password' }}
              </ion-button>
              <span v-if="pwd.success" class="profile__success">{{ pwd.success }}</span>
            </div>
            <p v-if="pwd.error" class="profile__error">{{ pwd.error }}</p>

            <p class="profile__hint">
              <router-link :to="{ name: 'forgot-password' }">Forgot current password?</router-link>
            </p>
          </form>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { IonPage, IonContent, IonButton } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const BIO_MAX = 500;
const auth = useAuthStore();

/* ---------- Profile form ---------- */
const form = ref({ firstName: '', lastName: '', bio: '', avatarUrl: '' });
const saving = ref(false);
const savedMessage = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

const initials = computed(() =>
  [form.value.firstName, form.value.lastName]
    .filter(Boolean)
    .map((s) => s!.charAt(0))
    .join('')
    .toUpperCase() || 'U',
);

/* ---------- Password form ---------- */
const pwd = reactive({
  current: '',
  next: '',
  confirm: '',
  showCurrent: false,
  showNext: false,
  showConfirm: false,
  saving: false,
  success: null as string | null,
  error: null as string | null,
});

const policy = computed(() => {
  const p = pwd.next;
  const length = p.length >= 8;
  const lower = /[a-z]/.test(p);
  const upper = /[A-Z]/.test(p);
  const digit = /\d/.test(p);
  const differs = p.length > 0 && p !== pwd.current;
  const valid = length && lower && upper && digit && differs
    && pwd.confirm === p && pwd.current.length > 0;
  return { length, lower, upper, digit, differs, valid };
});

onMounted(() => {
  form.value.firstName = auth.user?.firstName ?? '';
  form.value.lastName = auth.user?.lastName ?? '';
  form.value.bio = auth.user?.bio ?? '';
  form.value.avatarUrl = auth.user?.avatarUrl ?? '';
});

async function save() {
  if (!auth.user) return;
  saving.value = true;
  savedMessage.value = null;
  errorMessage.value = null;
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: form.value.firstName.trim(),
        last_name: form.value.lastName.trim(),
        bio: form.value.bio.trim() || null,
        avatar_url: form.value.avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id);
    if (error) throw error;
    await auth.refresh();
    savedMessage.value = 'Profile updated.';
  } catch (e: unknown) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to save.';
  } finally {
    saving.value = false;
  }
}

async function changePassword() {
  pwd.error = null;
  pwd.success = null;

  const email = auth.user?.email;
  if (!email) {
    pwd.error = 'You need to be signed in to change your password.';
    return;
  }
  if (!policy.value.valid) {
    pwd.error = 'Password does not meet requirements.';
    return;
  }

  pwd.saving = true;
  try {
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: pwd.current,
    });
    if (signInErr) throw new Error('Current password is incorrect.');

    await auth.updatePassword(pwd.next);

    pwd.success = 'Password updated.';
    pwd.current = pwd.next = pwd.confirm = '';
    pwd.showCurrent = pwd.showNext = pwd.showConfirm = false;
  } catch (e: unknown) {
    pwd.error = e instanceof Error ? e.message : 'Failed to update password.';
  } finally {
    pwd.saving = false;
  }
}
</script>

<style scoped>
.page-shell--narrow { max-width: 720px; }

/* ───────── Profile header card ───────── */
.profile__card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: var(--plumi-panel-padding);
  background: var(--plumi-primary-subtle);
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-xl);
  color: var(--plumi-ink);
}
.profile__avatar {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: var(--plumi-radius-pill);
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
  font-size: var(--plumi-text-xl);
  font-weight: var(--plumi-weight-bold);
  overflow: hidden;
  flex: 0 0 auto;
}
.profile__avatar img { width: 100%; height: 100%; object-fit: cover; }
.profile__meta { min-width: 0; }
.profile__name {
  margin: 0;
  font-size: var(--plumi-text-lg);
  font-weight: var(--plumi-weight-semibold);
  color: var(--plumi-ink);
}
.profile__email {
  margin: 2px 0;
  font-size: var(--plumi-text-sm);
  color: var(--plumi-text-muted);
  overflow-wrap: anywhere;
  line-height: 1.65;
}
.profile__role {
  display: inline-block;
  margin-top: 10px;
  padding: 5px 10px;
  border-radius: var(--plumi-radius-sm);
  background: var(--plumi-primary-soft);
  font-size: var(--plumi-text-xs);
  font-weight: var(--plumi-weight-bold);
  color: var(--plumi-primary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ───────── Form cards ───────── */
.profile__form-card {
  min-width: 0;
  padding: var(--plumi-panel-padding);
  background: var(--plumi-surface);
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-lg);
  box-shadow: var(--plumi-shadow-card);
}
.profile__section-title {
  margin: 0 0 12px;
  font-size: var(--plumi-text-md);
  font-weight: var(--plumi-weight-semibold);
  color: var(--plumi-ink);
}

.profile__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.profile__form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--plumi-text-sm);
  color: var(--plumi-text-muted);
  line-height: 1.6;
}

/* Inputs — inherit global.css styles, then refine */
.profile__form input,
.profile__form textarea {
  padding: 12px 14px;
  border: 1px solid var(--plumi-border-strong);
  border-radius: var(--plumi-radius-md);
  background: var(--plumi-surface);
  color: var(--plumi-ink);
  font-size: var(--plumi-text-sm);
  font-family: var(--plumi-font-body);
  min-height: 44px;
  transition: border-color var(--plumi-duration-fast) var(--plumi-easing),
              box-shadow var(--plumi-duration-fast) var(--plumi-easing);
}
.profile__form input:focus-visible,
.profile__form textarea:focus-visible {
  outline: none;
  border-color: var(--plumi-primary);
  box-shadow: var(--plumi-focus-ring);
}
.profile__form input:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Bio: fixed size, scrolls internally, cannot be dragged */
.profile__bio {
  min-height: 88px;
  max-height: 120px;
  resize: none;
  overflow-y: auto;
  line-height: var(--plumi-line-relaxed, 1.55);
}

/* Character counter */
.profile__counter {
  margin-top: -4px;
  align-self: flex-end;
  font-size: var(--plumi-text-xs);
  color: var(--plumi-text-muted);
  font-variant-numeric: tabular-nums;
  transition: color var(--plumi-duration-fast) var(--plumi-easing);
}
.profile__counter.is-limit {
  color: var(--plumi-danger);
  font-weight: var(--plumi-weight-semibold);
}

/* ───────── Actions ───────── */
.profile__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.profile__success {
  color: var(--plumi-success);
  font-size: var(--plumi-text-sm);
  font-weight: var(--plumi-weight-semibold);
}
.profile__error {
  margin: 0;
  color: var(--plumi-danger);
  font-size: var(--plumi-text-sm);
}
.profile__hint {
  margin: 0;
  font-size: var(--plumi-text-xs);
  color: var(--plumi-text-muted);
}
.profile__hint a {
  color: var(--plumi-primary);
  font-weight: var(--plumi-weight-semibold);
  text-decoration: none;
}
.profile__hint a:hover { text-decoration: underline; }

/* ───────── Password field wrapper ───────── */
.pwd-field { position: relative; display: flex; }
.pwd-field input { flex: 1; padding-right: 42px; }

.pwd-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--plumi-text-muted);
  border-radius: var(--plumi-radius-sm);
  cursor: pointer;
  transition: color var(--plumi-duration-fast) var(--plumi-easing),
              background var(--plumi-duration-fast) var(--plumi-easing);
}
.pwd-toggle:hover {
  color: var(--plumi-ink);
  background: var(--plumi-surface-muted);
}
.pwd-toggle:focus-visible {
  outline: 2px solid var(--plumi-primary);
  outline-offset: 2px;
}

/* ───────── Password policy ───────── */
.pwd-policy {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
  font-size: var(--plumi-text-xs);
  color: var(--plumi-text-subtle);
}
.pwd-policy li {
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color var(--plumi-duration-fast) var(--plumi-easing);
}
.pwd-policy__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--plumi-radius-pill);
  background: var(--plumi-border-strong);
  flex: 0 0 auto;
  transition: background var(--plumi-duration-fast) var(--plumi-easing);
}
.pwd-policy li.is-met { color: var(--plumi-success); }
.pwd-policy li.is-met .pwd-policy__dot { background: var(--plumi-success); }

.pwd-mismatch {
  margin: 0;
  font-size: var(--plumi-text-xs);
  color: var(--plumi-danger);
}

/* ───────── Mobile ───────── */
@media (max-width: 600px) {
  .profile__card { padding: 20px; gap: 14px; }
  .profile__avatar { width: 60px; height: 60px; font-size: var(--plumi-text-lg); }
  .profile__actions > ion-button { flex: 1 1 auto; min-height: 44px; }
  .pwd-policy { grid-template-columns: 1fr; }
}
</style>