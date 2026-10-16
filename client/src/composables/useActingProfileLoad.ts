import { ref, watch } from 'vue';

import { useEventsStore } from '@/stores/events';
import { useApiErrorMessage } from './useApiErrorMessage';

// Runs `load` for the current event section now and again whenever the event
// or the acting profile changes, tracking the loading state and the error
// message to show with a "try again" button (`reload`).
export const useActingProfileLoad = (load: () => Promise<unknown>) => {
  const events = useEventsStore();
  const errorMessage = useApiErrorMessage();
  const loading = ref(false);
  const error = ref<string | null>(null);

  const reload = async () => {
    if (!events.event || !events.actingParticipant) return;
    loading.value = true;
    error.value = null;
    try {
      await load();
    } catch (e) {
      error.value = errorMessage(e);
    } finally {
      loading.value = false;
    }
  };

  watch(
    () => [events.event?.id, events.actingParticipant?.id],
    () => reload(),
    { immediate: true },
  );

  return { loading, error, reload };
};
