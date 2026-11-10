<!-- src/views/student/ai/AiPracticePage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <h1 class="ap__title">AI Practice</h1>
        <p class="ap__lead">Generate gamified practice questions from a course material.</p>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState
          v-else-if="!materials.length"
          title="No materials available"
          message="Your course has no materials with extracted text yet."
        />

        <template v-else>
          <ion-list>
            <ion-radio-group v-model="selectedMaterialId">
              <ion-item v-for="m in materials" :key="m.id">
                <ion-radio :value="m.id" />
                <ion-label>
                  <h2>{{ m.title }}</h2>
                  <p>{{ m.type }} · {{ (m.extracted_text?.length ?? 0).toLocaleString() }} chars</p>
                </ion-label>
              </ion-item>
            </ion-radio-group>
          </ion-list>

          <div class="ap__controls">
            <ion-item>
              <ion-label>Questions</ion-label>
              <ion-select v-model="questionCount" interface="popover">
                <ion-select-option :value="5">5</ion-select-option>
                <ion-select-option :value="10">10</ion-select-option>
                <ion-select-option :value="15">15</ion-select-option>
                <ion-select-option :value="20">20</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-button
              expand="block"
              :disabled="!selectedMaterialId || generating"
              @click="onGenerate"
            >
              <ion-spinner v-if="generating" slot="start" name="crescent" />
              {{ generating ? 'Generating…' : 'Generate & Start' }}
            </ion-button>
          </div>

          <p v-if="genError" class="ap__error">{{ genError }}</p>

          <section v-if="myGenerations.length" class="ap__history">
            <h2>Your practice sets</h2>
            <ion-list>
              <ion-item
                v-for="g in myGenerations"
                :key="g.id"
                button
                @click="openSession(g.id)"
              >
                <ion-label>
                  <h2>{{ g.title }}</h2>
                  <p>{{ new Date(g.created_at).toLocaleString() }}</p>
                </ion-label>
                <ion-icon slot="end" :icon="chevronForwardOutline" />
              </ion-item>
            </ion-list>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonButton, IonIcon, IonList, IonItem, IonLabel,
  IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonSpinner,
} from '@ionic/vue';
import {
  arrowBackOutline, chevronForwardOutline,
} from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import {
  listGeneratableMaterials, generateQuestions, listMyGenerations,
} from '@/services/ai';
import type { Material, MaterialGeneration } from '@/types/app';

const route = useRoute();
const router = useRouter();
const courseId = route.params.id as string;

const materials = ref<Material[]>([]);
const myGenerations = ref<MaterialGeneration[]>([]);
const selectedMaterialId = ref<string | null>(null);
const questionCount = ref(10);

const loading = ref(true);
const error = ref<string | null>(null);
const generating = ref(false);
const genError = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [mats, gens] = await Promise.all([
      listGeneratableMaterials(courseId),
      listMyGenerations(courseId),
    ]);
    materials.value = mats;
    myGenerations.value = gens;
    if (!selectedMaterialId.value && mats.length) selectedMaterialId.value = mats[0].id;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
}

async function onGenerate() {
  if (!selectedMaterialId.value) return;
  generating.value = true;
  genError.value = null;
  try {
    const { generationId } = await generateQuestions({
      materialId: selectedMaterialId.value,
      questionCount: questionCount.value,
    });
    router.push({ name: 'student-ai-session', params: { generationId } });
  } catch (e: unknown) {
    genError.value = e instanceof Error ? e.message : 'Generation failed.';
  } finally {
    generating.value = false;
  }
}

function openSession(generationId: string) {
  router.push({ name: 'student-ai-session', params: { generationId } });
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<style scoped>
.page-shell--narrow { max-width: 820px; }
.ap__title { margin: 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.ap__lead { color: var(--plumi-text-muted); margin-top: 0; }
.ap__controls { margin-top: var(--size-4, 1rem); display: grid; gap: var(--size-2, 0.5rem); }
.ap__error { color: var(--plumi-danger); }
.ap__history { margin-top: var(--size-6, 1.5rem); }
</style>