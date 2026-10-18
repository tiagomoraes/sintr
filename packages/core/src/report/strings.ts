/**
 * The words a report prints that nobody wrote for this person: headings,
 * labels, the foot. In the report's language (Portuguese, Spanish or
 * English); the person's own words are never translated.
 */
import type { ReportLanguage, ReportSection } from "./content";

export interface ReportStrings {
  doc: string;
  titleNamed: (name: string) => string;
  titleAnonymous: string;
  confidential: string;
  forTherapist: (therapist: string) => string;
  factSession: string;
  factWeek: string;
  factCheckins: string;
  factMoments: string;
  coverage: (n: number, total: number) => string;
  coverageMissing: (days: string) => string;
  draft: string;
  sections: Record<ReportSection, string>;
  averages: { mood: string; energy: string; anxiety: string; sleepHours: string };
  of5: string;
  perNight: string;
  nDays: (n: number) => string;
  previous: (value: string) => string;
  previousNone: string;
  legendMood: string;
  legendAnxiety: string;
  thisPeriod: string;
  chartA: (low: number) => string;
  chartB: string;
  chartNote: (weeks: number) => string;
  chartAlt: (start: string, end: string) => string;
  gridCaption: string;
  rows: { mood: string; energy: string; anxiety: string; sleepHours: string; entries: string };
  dayNotes: string;
  noCheckins: string;
  moment: {
    happened: string;
    context: string;
    thoughts: string;
    felt: string;
    body: string;
    did: string;
    evidenceFor: string;
    evidenceAgainst: string;
    alternative: string;
    feltAfter: string;
  };
  notRecorded: string;
  strongest: string;
  of100: string;
  belief: (value: number) => string;
  suggested: string;
  nothingThisWeek: string;
  footPrepared: (reviewedBy: string) => string;
  footReviewedNamed: (name: string) => string;
  footReviewedAnonymous: string;
  footObservations: string;
  footClinical: string;
  footQuotes: string;
  footSuggested: string;
  footRealtime: string;
  running: (name: string | null, label: string) => string;
  months: string[];
  /** Sunday first. */
  weekdays: string[];
  weekdaysShort: string[];
}

export const REPORT_STRINGS: Record<ReportLanguage, ReportStrings> = {
  en: {
    doc: "Weekly report",
    titleNamed: (name) => `${name}'s week, in their own words.`,
    titleAnonymous: "The week, in their own words.",
    confidential: "Confidential",
    forTherapist: (therapist) => `for ${therapist}`,
    factSession: "Session",
    factWeek: "Week",
    factCheckins: "Check-ins",
    factMoments: "Moments recorded",
    coverage: (n, total) => `${n} of ${total} days`,
    coverageMissing: (days) => `none on ${days}`,
    draft: "Draft, not reviewed yet. Do not send.",
    sections: {
      week: "How the week went",
      session: "For the session",
      mood: "Mood, energy and sleep",
      moments: "Moments that stood out",
      patterns: "What repeated",
      helped: "What helped",
    },
    averages: {
      mood: "Average mood",
      energy: "Average energy",
      anxiety: "Average anxiety",
      sleepHours: "Average sleep",
    },
    of5: "of 5",
    perNight: "a night",
    nDays: (n) => (n === 1 ? "1 day" : `${n} days`),
    previous: (value) => `week before: ${value}`,
    previousNone: "no week before",
    legendMood: "Mood",
    legendAnxiety: "Anxiety",
    thisPeriod: "this week",
    chartA: (low) => `Mood and anxiety, from ${low} (low) to 5 (high)`,
    chartB: "Sleep, in hours a night",
    chartNote: (weeks) =>
      `Last ${weeks} weeks, this one highlighted; dots are this week's check-ins. A dotted stretch crosses days without a check-in: no value is estimated.`,
    chartAlt: (start, end) => `Mood and anxiety from ${start} to ${end}, and hours of sleep per night.`,
    gridCaption: "The week day by day",
    rows: { mood: "Mood", energy: "Energy", anxiety: "Anxiety", sleepHours: "Sleep", entries: "Moments" },
    dayNotes: "In the day's own words",
    noCheckins: "No check-ins this week.",
    moment: {
      happened: "What happened",
      context: "Context",
      thoughts: "What went through their mind",
      felt: "What they felt",
      body: "In the body",
      did: "What they did",
      evidenceFor: "What supported the thought",
      evidenceAgainst: "What did not",
      alternative: "Another way to see it",
      feltAfter: "Afterwards",
    },
    notRecorded: "not recorded",
    strongest: "the strongest",
    of100: "of 100",
    belief: (value) => `believes it ${value} of 100`,
    suggested: "suggested by sintr",
    nothingThisWeek: "Nothing written here this week.",
    footPrepared: (reviewedBy) =>
      `Prepared from self-reports (check-ins and structured entries) with the help of a personal assistant${reviewedBy}.`,
    footReviewedNamed: (name) => `, and reviewed by ${name} before sending`,
    footReviewedAnonymous: ", and reviewed before sending",
    footObservations: "Observations are dated records, not diagnoses.",
    footClinical: "Not a clinical assessment.",
    footQuotes: "Highlighted words in quotes are the person's exact words, copied from their records.",
    footSuggested:
      "Items marked as suggested by sintr were proposed by the assistant and kept during review.",
    footRealtime: "This report is not monitored in real time and is not a crisis channel.",
    running: (name, label) =>
      name ? `sintr · ${name} · ${label} · confidential` : `sintr · ${label} · confidential`,
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  pt: {
    doc: "Relatório semanal",
    titleNamed: (name) => `A semana de ${name}, nas próprias palavras.`,
    titleAnonymous: "A semana, nas próprias palavras.",
    confidential: "Confidencial",
    forTherapist: (therapist) => `para ${therapist}`,
    factSession: "Sessão",
    factWeek: "Semana",
    factCheckins: "Check-ins",
    factMoments: "Momentos registrados",
    coverage: (n, total) => `${n} de ${total} dias`,
    coverageMissing: (days) => `sem check-in: ${days}`,
    draft: "Rascunho, ainda não revisado. Não enviar.",
    sections: {
      week: "Como foi a semana",
      session: "Para conversar na sessão",
      mood: "Humor, energia e sono",
      moments: "Momentos que marcaram",
      patterns: "O que se repetiu",
      helped: "O que ajudou",
    },
    averages: {
      mood: "Humor médio",
      energy: "Energia média",
      anxiety: "Ansiedade média",
      sleepHours: "Sono médio",
    },
    of5: "de 5",
    perNight: "por noite",
    nDays: (n) => (n === 1 ? "1 dia" : `${n} dias`),
    previous: (value) => `semana anterior: ${value}`,
    previousNone: "sem semana anterior",
    legendMood: "Humor",
    legendAnxiety: "Ansiedade",
    thisPeriod: "esta semana",
    chartA: (low) => `Humor e ansiedade, de ${low} (baixo) a 5 (alto)`,
    chartB: "Sono, em horas por noite",
    chartNote: (weeks) =>
      `Últimas ${weeks} semanas, esta em destaque; os pontos são os check-ins desta semana. O trecho pontilhado atravessa dias sem check-in: nenhum valor é estimado.`,
    chartAlt: (start, end) => `Humor e ansiedade de ${start} a ${end}, e horas de sono por noite.`,
    gridCaption: "A semana dia a dia",
    rows: { mood: "Humor", energy: "Energia", anxiety: "Ansiedade", sleepHours: "Sono", entries: "Momentos" },
    dayNotes: "Nas palavras do dia",
    noCheckins: "Nenhum check-in nesta semana.",
    moment: {
      happened: "O que aconteceu",
      context: "Contexto",
      thoughts: "O que passou pela cabeça",
      felt: "O que sentiu",
      body: "No corpo",
      did: "O que fez",
      evidenceFor: "O que sustentava o pensamento",
      evidenceAgainst: "O que não sustentava",
      alternative: "Outro jeito de ver",
      feltAfter: "Depois",
    },
    notRecorded: "não registrado",
    strongest: "o mais forte",
    of100: "de 100",
    belief: (value) => `acredita ${value} de 100`,
    suggested: "sugestão do sintr",
    nothingThisWeek: "Nada escrito aqui nesta semana.",
    footPrepared: (reviewedBy) =>
      `Preparado a partir de autorregistros (check-ins e registros estruturados) com a ajuda de um assistente pessoal${reviewedBy}.`,
    footReviewedNamed: (name) => `, e revisado por ${name} antes do envio`,
    footReviewedAnonymous: ", e revisado antes do envio",
    footObservations: "As observações são registros datados, não diagnósticos.",
    footClinical: "Não é uma avaliação clínica.",
    footQuotes: "Trechos entre aspas e marcados são as palavras exatas da pessoa, copiadas dos registros.",
    footSuggested:
      "Itens marcados como sugestão do sintr foram propostos pelo assistente e mantidos na revisão.",
    footRealtime: "Este relatório não é acompanhado em tempo real e não serve para situações de crise.",
    running: (name, label) =>
      name ? `sintr · ${name} · ${label} · confidencial` : `sintr · ${label} · confidencial`,
    months: [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ],
    weekdays: ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"],
    weekdaysShort: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
  },
  es: {
    doc: "Informe semanal",
    titleNamed: (name) => `La semana de ${name}, en sus propias palabras.`,
    titleAnonymous: "La semana, en sus propias palabras.",
    confidential: "Confidencial",
    forTherapist: (therapist) => `para ${therapist}`,
    factSession: "Sesión",
    factWeek: "Semana",
    factCheckins: "Registros diarios",
    factMoments: "Momentos registrados",
    coverage: (n, total) => `${n} de ${total} días`,
    coverageMissing: (days) => `sin registro: ${days}`,
    draft: "Borrador, aún sin revisar. No enviar.",
    sections: {
      week: "Cómo fue la semana",
      session: "Para hablar en la sesión",
      mood: "Ánimo, energía y sueño",
      moments: "Momentos que marcaron",
      patterns: "Lo que se repitió",
      helped: "Lo que ayudó",
    },
    averages: {
      mood: "Ánimo medio",
      energy: "Energía media",
      anxiety: "Ansiedad media",
      sleepHours: "Sueño medio",
    },
    of5: "de 5",
    perNight: "por noche",
    nDays: (n) => (n === 1 ? "1 día" : `${n} días`),
    previous: (value) => `semana anterior: ${value}`,
    previousNone: "sin semana anterior",
    legendMood: "Ánimo",
    legendAnxiety: "Ansiedad",
    thisPeriod: "esta semana",
    chartA: (low) => `Ánimo y ansiedad, de ${low} (bajo) a 5 (alto)`,
    chartB: "Sueño, en horas por noche",
    chartNote: (weeks) =>
      `Últimas ${weeks} semanas, esta destacada; los puntos son los registros de esta semana. El tramo punteado cruza días sin registro: ningún valor se estima.`,
    chartAlt: (start, end) => `Ánimo y ansiedad del ${start} al ${end}, y horas de sueño por noche.`,
    gridCaption: "La semana día a día",
    rows: { mood: "Ánimo", energy: "Energía", anxiety: "Ansiedad", sleepHours: "Sueño", entries: "Momentos" },
    dayNotes: "En las palabras del día",
    noCheckins: "Ningún registro diario esta semana.",
    moment: {
      happened: "Qué pasó",
      context: "Contexto",
      thoughts: "Qué pasó por su cabeza",
      felt: "Qué sintió",
      body: "En el cuerpo",
      did: "Qué hizo",
      evidenceFor: "Lo que sostenía el pensamiento",
      evidenceAgainst: "Lo que no lo sostenía",
      alternative: "Otra forma de verlo",
      feltAfter: "Después",
    },
    notRecorded: "no registrado",
    strongest: "el más fuerte",
    of100: "de 100",
    belief: (value) => `lo cree ${value} de 100`,
    suggested: "sugerencia de sintr",
    nothingThisWeek: "Nada escrito aquí esta semana.",
    footPrepared: (reviewedBy) =>
      `Preparado a partir de autorregistros (registros diarios y estructurados) con la ayuda de un asistente personal${reviewedBy}.`,
    footReviewedNamed: (name) => `, y revisado por ${name} antes del envío`,
    footReviewedAnonymous: ", y revisado antes del envío",
    footObservations: "Las observaciones son registros fechados, no diagnósticos.",
    footClinical: "No es una evaluación clínica.",
    footQuotes:
      "Las palabras entre comillas y resaltadas son las palabras exactas de la persona, copiadas de sus registros.",
    footSuggested:
      "Los puntos marcados como sugerencia de sintr los propuso el asistente y se mantuvieron en la revisión.",
    footRealtime: "Este informe no se sigue en tiempo real y no sirve para situaciones de crisis.",
    running: (name, label) =>
      name ? `sintr · ${name} · ${label} · confidencial` : `sintr · ${label} · confidencial`,
    months: [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ],
    weekdays: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    weekdaysShort: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  },
};
