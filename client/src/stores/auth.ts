import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { api, type Person } from '@/api';
import { readStored, removeStored, writeStored } from '@/lib/safeStorage';

export const MAGIC_TOKEN_STORAGE_KEY = 'secret-santa.magicToken';

// The signed-in person: their magic token (ADR-0001) and who it identifies.
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(readStored(MAGIC_TOKEN_STORAGE_KEY));
  const me = ref<Person | null>(null);

  const isSignedIn = computed(() => token.value !== null);

  // Asks the server who the stored magic token identifies. A `401` signs out
  // (through the api client) and rejects.
  const loadMe = async (): Promise<Person> => {
    const person = await api.getMe();
    me.value = person;
    return person;
  };

  // Stores the magic token from a personal link and validates it.
  const signIn = async (magicToken: string): Promise<Person> => {
    token.value = magicToken;
    me.value = null;
    writeStored(MAGIC_TOKEN_STORAGE_KEY, magicToken);
    return loadMe();
  };

  const signOut = () => {
    token.value = null;
    me.value = null;
    removeStored(MAGIC_TOKEN_STORAGE_KEY);
  };

  return { token, me, isSignedIn, loadMe, signIn, signOut };
});
