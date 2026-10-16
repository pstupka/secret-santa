import { computed, ref, watch } from 'vue';

import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useEventsStore } from '@/stores/events';
import { loadAssignmentState, type AssignmentState } from './myAssignment';

// The acting participant's assignment in the event loaded into the `events`
// store; reloads when the event, its status or the acting profile changes.
export const useMyAssignment = () => {
  const events = useEventsStore();
  const errorMessage = useApiErrorMessage();

  const state = ref<AssignmentState | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);

  const key = computed(() =>
    events.event
      ? `${events.event.id}/${events.event.status}/${events.actingAs ?? ''}`
      : null,
  );

  let latest = 0;
  const load = async () => {
    const event = events.event;
    if (!event) return;
    const request = ++latest;
    loading.value = true;
    error.value = null;
    state.value = null;
    try {
      const next = await loadAssignmentState(event, events.actingAs);
      // A quicker profile switch wins over a slower earlier answer.
      if (request === latest) state.value = next;
    } catch (e) {
      if (request === latest) error.value = errorMessage(e);
    } finally {
      if (request === latest) loading.value = false;
    }
  };

  watch(key, load, { immediate: true });

  return { state, error, loading, reload: load };
};
