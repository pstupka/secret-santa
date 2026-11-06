<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import GiftTag from '@/components/GiftTag.vue';
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

// The example tag works like the real one: sealed until you look.
const exampleRevealed = ref(false);
</script>

<template>
  <div class="space-y-16 sm:space-y-24">
    <div v-if="signedOut || signInNeeded" class="max-w-3xl">
      <p v-if="signedOut" class="alert-error" role="alert">
        {{ $t('landing.signedOutNotice') }}
      </p>
      <p v-if="signInNeeded" class="alert-info" role="status">
        {{ $t('landing.signInNotice') }}
      </p>
    </div>

    <section
      class="grid items-center gap-12 sm:pt-4 md:grid-cols-[1.05fr_1fr] md:gap-10"
      aria-labelledby="landing-title"
    >
      <div>
        <h1
          id="landing-title"
          class="text-4xl leading-[1.05] font-bold tracking-[-0.02em] sm:text-6xl"
        >
          {{ $t('landing.heroTitle') }}
        </h1>
        <p class="mt-5 max-w-[34ch] text-lg text-stone-800 sm:text-xl">
          {{ $t('landing.heroLead') }}
        </p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <RouterLink
            v-if="!auth.isSignedIn"
            :to="{ name: 'new-event' }"
            class="btn-primary w-full px-7 sm:w-auto"
          >
            {{ $t('landing.createEvent') }}
          </RouterLink>
          <RouterLink
            v-else
            :to="{ name: 'events' }"
            class="btn-primary w-full px-7 sm:w-auto"
          >
            {{ $t('landing.goToMyEvents') }}
          </RouterLink>
        </div>
      </div>

      <figure class="md:-rotate-2">
        <GiftTag>
          <p class="font-display text-2xl font-bold text-pine-900">
            {{ $t('landing.example.title') }}
          </p>
          <p class="mt-1 text-stone-600">{{ $t('landing.example.meta') }}</p>
          <div class="sheet-rule mt-5 pt-5">
            <p class="text-stone-700">{{ $t('assignment.youGiveTo') }}</p>
            <p
              v-if="exampleRevealed"
              class="mt-1 font-display text-4xl font-bold text-cranberry-700"
            >
              {{ $t('landing.example.recipient') }}
            </p>
            <span
              v-if="exampleRevealed"
              class="mt-3 block h-1 w-20 rounded-full bg-gold-400"
              aria-hidden="true"
            />
            <div v-else class="mt-3 flex items-center gap-3">
              <span
                class="flex size-11 shrink-0 items-center justify-center rounded-full bg-cranberry-600 ring-4 ring-cranberry-700/30"
                aria-hidden="true"
              >
                <span class="size-7 rounded-full ring-2 ring-gold-300/70" />
              </span>
              <button
                type="button"
                class="btn-secondary"
                @click="exampleRevealed = true"
              >
                {{ $t('assignment.sealed.reveal') }}
              </button>
            </div>
          </div>
        </GiftTag>
        <figcaption class="mt-4 pl-12 text-sm text-stone-700">
          {{ $t('landing.example.caption') }}
        </figcaption>
      </figure>
    </section>

    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works" class="text-3xl font-bold">
        {{ $t('landing.howItWorks') }}
      </h2>
      <ol class="relative mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
        <!-- One length of twine strung through every step. -->
        <span
          class="absolute top-0 bottom-0 left-3.75 w-0.5 bg-cranberry-600 md:top-3.75 md:right-0 md:bottom-auto md:left-0 md:h-0.5 md:w-auto"
          aria-hidden="true"
        />
        <li
          v-for="(step, index) in steps"
          :key="step"
          class="relative pl-14 md:pt-14 md:pl-0"
        >
          <span
            class="absolute top-0 left-0 flex size-8 items-center justify-center rounded-full bg-paper font-display font-bold text-cranberry-700 ring-2 ring-cranberry-600"
            aria-hidden="true"
          >
            {{ index + 1 }}
          </span>
          <h3 class="text-xl font-bold">
            {{ $t(`landing.steps.${step}.title`) }}
          </h3>
          <p class="mt-2 max-w-[38ch] text-stone-800">
            {{ $t(`landing.steps.${step}.body`) }}
          </p>
        </li>
      </ol>
    </section>

    <div class="max-w-2xl">
      <LostLinkForm />
    </div>
  </div>
</template>
