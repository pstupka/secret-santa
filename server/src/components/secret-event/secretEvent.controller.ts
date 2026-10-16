import { Request, Response } from 'express';
import httpStatus from 'http-status';

const getAllSecretEvents = (req: Request, res: Response) => {
  res.status(httpStatus.OK);
  res.send({ status: 'OK', data: [new Date().toJSON()] });
};

const getSecretEvent = (req: Request, res: Response) => {
  res.status(httpStatus.OK);
  res.send({ status: 'OK', data: new Date().toJSON() });
};

const createSecretEvent = (req: Request, res: Response) => {
  res.status(httpStatus.CREATED);
  res.send({ status: 'CREATED', data: new Date().toJSON() });
};

const updateSecretEvent = (req: Request, res: Response) => {
  res.status(httpStatus.OK);
  res.send({ status: 'OK', data: new Date().toJSON() });
};

const deleteSecretEvent = (req: Request, res: Response) => {
  res.status(httpStatus.NO_CONTENT);
  res.send({ status: 'NO_CONTENT' });
};

export default {
  getAllSecretEvents,
  getSecretEvent,
  createSecretEvent,
  updateSecretEvent,
  deleteSecretEvent,
};
