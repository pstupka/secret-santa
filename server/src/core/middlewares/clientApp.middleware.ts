import { join, sep } from 'node:path';
import express, { NextFunction, Request, Response, Router } from 'express';

import consts from '@config/consts';

const isApiPath = (path: string): boolean =>
  path === consts.API_ROOT_PATH || path.startsWith(`${consts.API_ROOT_PATH}/`);

// A request for a file (`/assets/app.js`, `/favicon.ico`) rather than a page.
const looksLikeFile = (path: string): boolean =>
  /\.[^/]+$/.test(path.slice(path.lastIndexOf('/')));

// Serves the built client (`client/dist`) and falls back to its index.html for
// any other GET page route, so deep links like `/events/:id` reach the Vue
// router. `/api` and missing files are left to the JSON 404 handler.
const serveClientApp = (clientDir: string): Router => {
  const router: Router = Router();
  const indexHtml = join(clientDir, 'index.html');
  const assetsDir = join(clientDir, 'assets') + sep;

  router.use(
    express.static(clientDir, {
      index: false,
      setHeaders: (res, filePath) => {
        // Vite fingerprints everything under assets/; the rest may change.
        if (filePath.startsWith(assetsDir)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  router.use((req: Request, res: Response, next: NextFunction) => {
    if (
      (req.method !== 'GET' && req.method !== 'HEAD') ||
      isApiPath(req.path) ||
      looksLikeFile(req.path)
    ) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml, (error) => {
      if (error) {
        next(error);
      }
    });
  });

  return router;
};

export default serveClientApp;
