import AppError from '@core/utils/appError';
import logger from '@core/utils/logger';
import httpStatus from 'http-status';
import { ISecretEvent } from './secretEvent.interface';

let eventsStorage: Array<ISecretEvent> = [];

const create = (user: ISecretEvent): boolean => {
  return true;
};

const read = (id: string): ISecretEvent | undefined => {
  return undefined;
};

const update = (user: ISecretEvent): boolean => {
  return true;
};

const deleteById = (id: string) => {
  return true;
};

export { create, read, update, deleteById };
