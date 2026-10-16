import express, { Application } from 'express';

import createApi from 'api';
import httpContext from 'express-http-context';
import consts from '@config/consts';
import httpLogger from '@core/utils/httpLogger';
import errorHandling from '@core/middlewares/errorHandling.middleware';
import uniqueReqId from '@core/middlewares/uniqueReqId.middleware';
import http404 from '@components/404/404.router';
import swaggerApiDocs from '@components/swagger-ui/swagger.router';
import { AppDeps } from './deps';

const createApp = (deps: AppDeps): Application => {
  const app: Application = express();

  // Behind Caddy (docker network) req.ip must be the client, not the proxy,
  // for per-IP rate limits. Only loopback/private-network proxies are trusted.
  app.set('trust proxy', 'loopback, uniquelocal');

  app.use(httpContext.middleware);
  app.use(httpLogger.successHandler);
  app.use(httpLogger.errorHandler);
  app.use(uniqueReqId);
  app.use(express.json());
  app.use(consts.API_ROOT_PATH, createApi(deps));
  app.use(swaggerApiDocs);
  app.use(http404);

  app.use(errorHandling);

  return app;
};

export default createApp;
