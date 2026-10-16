import { useI18n } from 'vue-i18n';

import { isApiError } from '@/api';

// Turns a rejected api call into user-facing copy from `errors.*`.
export const useApiErrorMessage = () => {
  const { t } = useI18n();

  return (error: unknown): string => {
    if (!isApiError(error)) return t('errors.server');
    if (error.kind === 'rateLimited' && error.retryAfterSeconds) {
      const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
      return t('errors.rateLimitedRetry', { minutes });
    }
    return t(`errors.${error.kind}`);
  };
};
