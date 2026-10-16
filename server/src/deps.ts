import { Db } from '@db/database';
import { Clock } from '@shared/clock';

// Everything the HTTP layer needs from the outside world. Built once in
// server.ts and by the test harness, then passed down to component routers.
export interface AppDeps {
  db: Db;
  clock: Clock;
}
