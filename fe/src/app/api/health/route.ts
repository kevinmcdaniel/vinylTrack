import { getConfig } from '@/lib/config';

// Liveness for the compose healthcheck (#60): answers from the FE alone, with
// no BE call and no identity, so it stays green before real auth (#11) lands.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ data: { status: 'ok', version: getConfig().version } });
}
