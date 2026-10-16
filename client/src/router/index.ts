import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type RouterHistory,
} from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import LandingView from '@/views/LandingView.vue';

declare module 'vue-router' {
  interface RouteMeta {
    // Needs a stored magic token; otherwise the landing page is shown.
    requiresAuth?: boolean;
  }
}

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'landing', component: LandingView },
  {
    path: '/new',
    name: 'new-event',
    component: () => import('@/views/NewEventView.vue'),
  },
  {
    // Personal link landing: `/auth#token=…`.
    path: '/auth',
    name: 'auth',
    component: () => import('@/views/AuthView.vue'),
  },
  {
    path: '/events',
    name: 'events',
    component: () => import('@/views/EventsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
];

export const createAppRouter = (
  history: RouterHistory = createWebHistory(),
) => {
  const router = createRouter({
    history,
    routes,
    // Never scroll to `route.hash`: on `/auth` it holds the magic token.
    scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  });

  router.beforeEach((to) => {
    if (to.meta.requiresAuth && !useAuthStore().isSignedIn) {
      return { name: 'landing' };
    }
    return true;
  });

  return router;
};
