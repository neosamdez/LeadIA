import { proxy } from './_proxy.js';

export function onRequest(context) {
  return proxy(context.params.action, context);
}
