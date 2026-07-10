// Centrifugo channel-name helpers — ported from the original bundle (chunks/Cx0uHDNg.js).
// Keep names byte-identical so any reused client logic and server config line up.

export const channels = {
  captions: (sessionId: string) => `captions:session:${sessionId}`,
  settings: (sessionId: string) => `settings:session:${sessionId}`,
  participants: (sessionId: string) => `participants:session:${sessionId}`,
  joinRequestHost: (sessionId: string) => `join-request-host:session:${sessionId}`,
  joinRequestApplicant: (participantId: string) => `join-request-applicant:participant:${participantId}`,
  sessionHistory: (sessionId: string) => `session-history:session:${sessionId}`,
  calendarSync: (userId: string) => `calendar-sync:user:${userId}`
} as const;

// Namespace prefixes as configured in centrifugo/config.json (text before the first ':').
export const CHANNEL_NAMESPACES = [
  'captions',
  'settings',
  'participants',
  'join-request-host',
  'join-request-applicant',
  'session-history',
  'calendar-sync'
] as const;
