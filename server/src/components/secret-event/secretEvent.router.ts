import { Router } from 'express';

import secretEventController from './secretEvent.controller';

const router: Router = Router();

router.get('/events', secretEventController.getAllSecretEvents);
router.get('/event', secretEventController.getSecretEvent);
router.post('/event', secretEventController.createSecretEvent);
router.put('/event', secretEventController.updateSecretEvent);
router.delete('/event', secretEventController.deleteSecretEvent);

export default router;
