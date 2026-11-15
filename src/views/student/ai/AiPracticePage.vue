<!-- src/views/student/ai/AiPracticePage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <h1 class="ap__title">AI Study Tools</h1>
        <p class="ap__lead">Generate study resources from a course material.</p>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState
          v-else-if="!materials.length"
          title="No materials available"
          message="Your course has no materials with extracted text yet."
          :icon="documentTextOutline"
        />

        <template v-else>
          <!-- Resource type selector -->
          <div class="ap__types" role="tablist" aria-label="Resource type">
            <button
              v-for="t in RESOURCE_TYPES"
              :key="t.value"
              class="ap__type"
              :class="{ 'is-active': resourceType === t.value }"
              role="tab"
              :aria-selected="resourceType === t.value"
              @click="resourceType = t.value"
            >
              <ion-icon :icon="t.icon" />
              <span>{{ t.label }}</span>
            </button>
          </div>

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
            <ion-item v-if="resourceType === 'QUESTIONS'">
              <ion-label>Questions</ion-label>
              <ion-select v-model="questionCount" interface="popover">
                <ion-select-option :value="5">5</ion-select-option>
                <ion-select-option :value="10">10</ion-select-option>
                <ion-select-option :value="15">15</ion-select-option>
                <ion-select-option :value="20">20</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="resourceType === 'FLASHCARDS'">
              <ion-label>Cards</ion-label>
              <ion-select v-model="cardCount" interface="popover">
                <ion-select-option :value="10">10</ion-select-option>
                <ion-select-option :value="15">15</ion-select-option>
                <ion-select-option :value="20">20</ion-select-option>
                <ion-select-option :value="30">30</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label>Detail</ion-label>
              <ion-select v-model="detailLevel" interface="popover">
                <ion-select-option value="SHORT">Short</ion-select-option>
                <ion-select-option value="STANDARD">Standard</ion-select-option>
                <ion-select-option value="COMPREHENSIVE">Comprehensive</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-button
              expand="block"
              :disabled="!selectedMaterialId || generating"
              @click="onGenerate"
            >
              <ion-spinner v-if="generating" slot="start" name="crescent" />
              {{ generating ? 'Generating…' : `Generate ${labelFor(resourceType)}` }}
            </ion-button>
          </div>

          <p v-if="genError" class="ap__error">{{ genError }}</p>

          <section v-if="generationItems.length" class="ap__history">
            <h2>Your resources</h2>
            <ion-list>
              <ion-item
                v-for="g in generationItems"
                :key="g.id"
                button
                @click="openGeneration(g)"
              >
                <ion-label>
                  <h2>{{ g.title }}</h2>
                  <p>{{ typeLabel(g.type) }} · {{ g.createdAt }}</p>
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import {
  IonPage, IonContent, IonButton, IonIcon, IonList, IonItem, IonLabel,
  IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonSpinner,
} from '@ionic/vue';
import {
  arrowBackOutline, chevronForwardOutline, documentTextOutline,
  helpCircleOutline, albumsOutline, clipboardOutline, listOutline,
} from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import {
  listGeneratableMaterials, listMyGenerations, generateResource,
  type ResourceType,
} from '@/services/ai';
import type { Material, MaterialGeneration } from '@/types/app';

const route = useRoute();
const router = useRouter();
const courseId = route.params.id as string;

/* Resource type catalogue — icon + label per type. */
const RESOURCE_TYPES: { value: ResourceType; label: string; icon: string }[] = [
  { value: 'QUESTIONS',   label: 'Questions',   icon: helpCircleOutline },
  { value: 'FLASHCARDS',  label: 'Flashcards',  icon: albumsOutline },
  { value: 'SUMMARY',     label: 'Summary',     icon: documentTextOutline },
  { value: 'REVIEWER',    label: 'Reviewer',    icon: listOutline },
  { value: 'STUDY_GUIDE', label: 'Study guide', icon: clipboardOutline },
];

function labelFor(t: ResourceType): string {
  return RESOURCE_TYPES.find((r) => r.value === t)?.label ?? 'resource';
}

function typeLabel(t: string): string {
  return t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function routeFor(type: string, generationId: string): RouteLocationRaw {
  if (type === 'QUESTIONS') {
    return { name: 'student-ai-session', params: { generationId } };
  }
  if (type === 'FLASHCARDS') {
    return { name: 'student-ai-flashcards', params: { generationId } };
  }
  return { name: 'student-ai-generation', params: { generationId } };
}

/* State */
const materials = ref<Material[]>([]);
const myGenerations = ref<MaterialGeneration[]>([]);
const selectedMaterialId = ref<string | null>(null);
const resourceType = ref<ResourceType>('QUESTIONS');
const questionCount = ref(10);
const cardCount = ref(15);
const detailLevel = ref<'SHORT' | 'STANDARD' | 'COMPREHENSIVE'>('STANDARD');

const loading = ref(true);
const error = ref<string | null>(null);
const generating = ref(false);
const genError = ref<string | null>(null);

/* Flat view-model — keeps Json-typed fields out of the template so
   vue-tsc does not recurse through MaterialGeneration.content: Json. */
interface GenerationListItem {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

const generationItems = computed<GenerationListItem[]>(() => {
  // Iterate with a pre-annotated accumulator and `satisfies` each element.
  // Mapping directly over MaterialGeneration[] causes TS2589 because the
  // callback return type inference attempts to structurally expand the
  // recursive `content: Json` field against the target type.
  const out: GenerationListItem[] = [];
  for (const g of myGenerations.value) {
    out.push({
      id: g.id,
      title: g.title,
      type: g.type as string,
      createdAt: new Date(g.created_at).toLocaleString(),
    } satisfies GenerationListItem);
  }
  return out;
});

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
    const options =
      resourceType.value === 'QUESTIONS'   ? { question_count: questionCount.value } :
      resourceType.value === 'FLASHCARDS'  ? { card_count: cardCount.value } :
      undefined;

    const { generationId, type } = await generateResource({
      type: resourceType.value,
      materialId: selectedMaterialId.value,
      detailLevel: detailLevel.value,
      options,
    });

    await router.push(routeFor(type, generationId));
  } catch (e: unknown) {
    genError.value = e instanceof Error ? e.message : 'Generation failed.';
  } finally {
    generating.value = false;
  }
}

function openGeneration(item: GenerationListItem) {
  router.push(routeFor(item.type, item.id));
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<style scoped>
.page-shell--narrow { max-width: 820px; }
.ap__title { margin: 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.ap__lead { color: var(--plumi-text-muted); margin-top: 0; }

.ap__types {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin: var(--size-4, 1rem) 0;
}
.ap__type {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 1px solid var(--plumi-border);
  border-radius: 14px;
  background: var(--plumi-surface);
  color: var(--plumi-ink);
  cursor: pointer;
  font: inherit;
  font-size: var(--plumi-text-sm);
  transition: all 120ms ease;
}
.ap__type:hover { border-color: var(--plumi-primary); }
.ap__type.is-active {
  border-color: var(--plumi-primary);
  background: var(--plumi-primary-subtle, rgba(0,0,0,0.03));
  font-weight: 600;
}
.ap__type ion-icon { font-size: 22px; }

.ap__controls { margin-top: var(--size-4, 1rem); display: grid; gap: var(--size-2, 0.5rem); }
.ap__error { color: var(--plumi-danger); }
.ap__history { margin-top: var(--size-6, 1.5rem); }
</style>