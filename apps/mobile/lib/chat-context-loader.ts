import { getBroaderContextConsent } from './context-consent-storage';
import { buildAssistantContextPacketFromRows } from './context-packet';
import { getLocalDatabase, loadLocalContextRows } from './local-db';

export async function loadAssistantChatContextPacket(): Promise<
  ReturnType<typeof buildAssistantContextPacketFromRows>
> {
  const db = await getLocalDatabase();
  const rows = await loadLocalContextRows(db);
  const userConfirmedBroaderContext = await getBroaderContextConsent();
  return buildAssistantContextPacketFromRows(rows, {
    maxTotalChars: 12000,
    userConfirmedBroaderContext,
  });
}
