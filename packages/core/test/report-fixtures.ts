import { randomUUID } from "node:crypto";
import type { Checkin, CheckinInput, Entry, EntryInput, UserScope } from "../src";
import { zonedTime } from "../src/report/time";

/**
 * A fictional diary for the report tests: one person in São Paulo, weekly
 * sessions on Mondays at 18:00, writing in Portuguese. Every person and
 * event in it is invented.
 */
export const DEMO_TZ = "America/Sao_Paulo";
/** Mondays at 18:00, as the calendar holds a weekly rhythm. */
export const DEMO_SESSIONS = { startsOn: "2026-09-07", time: "18:00", repeat: "weekly" } as const;

export function local(month: number, day: number, hour = 12, minute = 0): Date {
  return zonedTime({ year: 2026, month, day, hour, minute }, DEMO_TZ);
}

/** The period of the report for Monday 19 October 18:00: 12 Oct 17:00 to 19 Oct 17:00. */
export const DEMO_PERIOD = {
  kind: "session" as const,
  label: "2026-10-19",
  start: local(10, 12, 17),
  end: local(10, 19, 17),
  session: local(10, 19, 18),
};

export const DEMO_ENTRIES: (EntryInput & { occurredAt: Date })[] = [
  {
    occurredAt: local(10, 11, 16, 20),
    title: "Domingo de tarde, olhando a agenda",
    situation: "em casa no domingo à tarde, abrindo a agenda da semana que vem",
    thoughts: ["lá vem tudo de novo"],
    emotions: [
      { name: "ansiedade", intensity: 55 },
      { name: "desânimo", intensity: 35 },
    ],
    tags: ["trabalho"],
  },
  {
    occurredAt: local(10, 13, 14, 30),
    title: "Reunião com quatro pedidos novos",
    situation: "na reunião da equipe chegaram quatro pedidos novos para a mesma semana",
    thoughts: ["não tem como dar conta de tudo", "se eu recusar vão me achar preguiçoso"],
    emotions: [
      { name: "ansiedade", intensity: 80 },
      { name: "irritação", intensity: 55 },
    ],
    body: "ombros duros, dor de cabeça",
    behavior: "disse sim aos quatro e fiquei até as 22h",
    context: "tinha dormido pouco",
    tags: ["trabalho"],
  },
  {
    occurredAt: local(10, 15, 16),
    title: "Conversa com a coordenadora",
    situation: "conversa a sós com a coordenadora sobre os prazos do mês",
    thoughts: ["ela acha que eu sou devagar", "eu sempre deixo a desejar"],
    emotions: [
      { name: "ansiedade", intensity: 65 },
      { name: "vergonha", intensity: 50 },
    ],
    body: "rosto quente",
    behavior: "pedi desculpas várias vezes e fiquei quieto o resto do dia",
    tags: ["trabalho"],
    hotThought: "eu sempre deixo a desejar",
    evidenceFor: "atrasei uma entrega em setembro",
    evidenceAgainst: "ela elogiou o cuidado com os detalhes",
    alternative: "ela pediu previsão, não disse que eu deixo a desejar",
    alternativeBelief: 50,
    emotionsAfter: [
      { name: "ansiedade", intensity: 40 },
      { name: "vergonha", intensity: 25 },
    ],
  },
  {
    occurredAt: local(10, 16, 12, 40),
    title: "Volta no parque na hora do almoço",
    situation: "saí para andar quinze minutos no parque no almoço, sem o telefone",
    thoughts: ["eu devia estar trabalhando", "faz tempo que eu não paro assim"],
    emotions: [
      { name: "culpa", intensity: 35 },
      { name: "alívio", intensity: 65 },
    ],
    body: "respiração mais solta",
    behavior: "voltei e terminei o dia sem levar trabalho para casa",
    tags: ["saúde"],
  },
  {
    occurredAt: local(10, 18, 17, 30),
    title: "Domingo de tarde de novo",
    situation: "domingo no fim da tarde, separando as coisas para a semana",
    thoughts: ["lá vem tudo de novo"],
    emotions: [
      { name: "ansiedade", intensity: 50 },
      { name: "desânimo", intensity: 30 },
    ],
    body: "aperto no peito",
    behavior: "arrumei a mochila e assisti a um filme",
    tags: ["trabalho"],
  },
];

/** Three weeks of check-ins before the period and the period's own (none on Wednesday 14). */
export const DEMO_CHECKINS: (CheckinInput & { occurredAt: Date })[] = [
  ...[22, 23, 24, 26, 28, 29, 30].map((day, i) => ({
    occurredAt: local(9, day, 9),
    mood: [3, 2, 3, 4, 3, 3, 4][i]!,
    anxiety: [3, 4, 3, 2, 3, 3, 2][i]!,
    sleepHours: [7, 6, 7.5, 8, 7, 7, 7.5][i]!,
  })),
  ...[1, 2, 5, 6, 7, 8, 9].map((day, i) => ({
    occurredAt: local(10, day, 9),
    mood: [4, 3, 3, 3, 3, 4, 3][i]!,
    energy: 3,
    anxiety: [2, 3, 3, 4, 3, 2, 3][i]!,
    sleepHours: [7.5, 7, 6.5, 6, 7, 7.5, 7][i]!,
  })),
  { occurredAt: local(10, 13, 8, 30), mood: 2, energy: 2, anxiety: 4, sleepHours: 6, note: "acordei moído" },
  {
    occurredAt: local(10, 15, 8, 40),
    mood: 2,
    energy: 2,
    anxiety: 4,
    sleepHours: 5.5,
    note: "dormi tarde terminando a planilha",
  },
  { occurredAt: local(10, 16, 9), mood: 4, energy: 3, anxiety: 2, sleepHours: 7 },
  {
    occurredAt: local(10, 17, 10),
    mood: 4,
    energy: 4,
    anxiety: 1,
    sleepHours: 8,
    note: "dormi sem despertador",
  },
  { occurredAt: local(10, 18, 11), mood: 3, energy: 3, anxiety: 3, sleepHours: 7.5 },
  { occurredAt: local(10, 19, 8), mood: 3, energy: 3, anxiety: 2, sleepHours: 7, note: "hoje tem sessão" },
];

export const DEMO_TO_BRING = ["A conversa com a coordenadora."];

/** Write the demo diary into a person's scope. */
export async function seedDemoDiary(scope: UserScope): Promise<void> {
  await scope.profile.update({ displayName: "Pessoa Exemplo", timezone: DEMO_TZ, locale: "pt-BR" });
  await scope.therapySettings.update({ therapistName: "Dra. Exemplo", reportLeadMinutes: 60 });
  await scope.sessions.add(DEMO_SESSIONS);
  for (const entry of DEMO_ENTRIES) await scope.entries.create(entry);
  for (const checkin of DEMO_CHECKINS) await scope.checkins.create(checkin);
  for (const body of DEMO_TO_BRING) await scope.therapyNotes.create({ kind: "to_bring", body });
}

/** The same diary as plain records, for tests without a database. */
export function demoRecords(): { entries: Entry[]; checkins: Checkin[] } {
  const stamp = new Date("2026-10-19T00:00:00Z");
  const entries = DEMO_ENTRIES.map((input): Entry => ({
    id: randomUUID(),
    occurredAt: input.occurredAt,
    title: input.title ?? null,
    situation: input.situation ?? null,
    thoughts: input.thoughts ?? null,
    emotions: input.emotions ?? null,
    body: input.body ?? null,
    behavior: input.behavior ?? null,
    context: input.context ?? null,
    tags: input.tags ?? null,
    notes: input.notes ?? null,
    hotThought: input.hotThought ?? null,
    evidenceFor: input.evidenceFor ?? null,
    evidenceAgainst: input.evidenceAgainst ?? null,
    alternative: input.alternative ?? null,
    alternativeBelief: input.alternativeBelief ?? null,
    emotionsAfter: input.emotionsAfter ?? null,
    peakIntensity: Math.max(...(input.emotions ?? []).map((e) => e.intensity ?? 0)),
    createdAt: stamp,
    updatedAt: stamp,
  }));
  const checkins = DEMO_CHECKINS.map((input): Checkin => ({
    id: randomUUID(),
    occurredAt: input.occurredAt,
    mood: input.mood ?? null,
    energy: input.energy ?? null,
    anxiety: input.anxiety ?? null,
    sleepHours: input.sleepHours ?? null,
    sleepQuality: input.sleepQuality ?? null,
    note: input.note ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  }));
  return { entries, checkins };
}
