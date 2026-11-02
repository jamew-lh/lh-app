import { handle } from '../../lib/app.mjs';

export default async (req, context) => handle(req, { ip: context?.ip || '' });

export const config = { path: '/api/*' };
