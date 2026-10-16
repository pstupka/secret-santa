import { v7 as uuidv7 } from 'uuid';

// All entity ids are UUIDv7: time-ordered, so they sort by creation.
const newId = (): string => uuidv7();

export default newId;
