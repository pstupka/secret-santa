<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import GiftIcon from '@/components/GiftIcon.vue';
import LostLinkForm from '@/components/LostLinkForm.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();

// Set by the api client after a `401` (see SIGNED_OUT_LOCATION).
const signedOut = computed(() => route.query.signedOut !== undefined);
// Set by the router when a signed-out person opened a page that needs a
// personal link; they return there after signing in.
const signInNeeded = computed(
  () => !signedOut.value && route.query.signIn !== undefined,
);

const steps = ['create', 'invite', 'draw'] as const;
</script>

<template>
  <div class="space-y-10 sm:space-y-14">
    <p v-if="signedOut" class="alert-error" role="alert">
      {{ $t('landing.signedOutNotice') }}
    </p>
    <p v-if="signInNeeded" class="alert-info" role="status">
      {{ $t('landing.signInNotice') }}
    </p>

    <section
      class="relative overflow-hidden rounded-3xl bg-pine-900 px-6 py-10 text-center text-white shadow-lg sm:px-12 sm:py-14"
    >
      <div
        class="snowfall pointer-events-none absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <GiftIcon class="relative mx-auto mb-5 size-16 drop-shadow" />
      <h1
        class="relative text-3xl leading-tight font-bold text-white sm:text-5xl"
      >
        {{ $t('landing.heroTitle') }}
      </h1>
      <p class="relative mx-auto mt-4 max-w-xl text-lg text-pine-100">
        {{ $t('landing.heroLead') }}
      </p>
      <div
        class="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
      >
        <RouterLink
          :to="{ name: 'new-event' }"
          class="btn-primary w-full sm:w-auto"
        >
          {{ $t('landing.createEvent') }}
        </RouterLink>
        <RouterLink
          v-if="auth.isSignedIn"
          :to="{ name: 'events' }"
          class="btn w-full border border-white/40 text-white hover:bg-white/10 sm:w-auto"
        >
          {{ $t('landing.goToMyEvents') }}
        </RouterLink>
      </div>
    </section>

    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works" class="text-center text-2xl font-bold">
        {{ $t('landing.howItWorks') }}
      </h2>
      <ol class="mt-6 grid gap-4 sm:grid-cols-3">
        <li v-for="(step, index) in steps" :key="step" class="card">
          <span
            class="flex size-9 items-center justify-center rounded-full bg-gold-300 font-bold text-pine-900"
          >
            {{ index + 1 }}
          </span>
          <h3 class="mt-3 text-lg font-bold">
            {{ $t(`landing.steps.${step}.title`) }}
          </h3>
          <p class="mt-1 text-stone-600">
            {{ $t(`landing.steps.${step}.body`) }}
          </p>
        </li>
      </ol>
    </section>

    <LostLinkForm />
  </div>
</template>
