import { AsyncLocalStorage } from "node:async_hooks";
export type AuditContext = {
  actorId?: string;
  companyId?: string;
  teamId?: string;
  ip?: string;
  correlationId: string;
};
export const requestContext = new AsyncLocalStorage<AuditContext>();
