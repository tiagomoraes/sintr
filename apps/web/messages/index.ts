import { checkin } from "./en/checkin";
import { connect } from "./en/connect";
import { entry } from "./en/entry";
import { home } from "./en/home";
import { plan } from "./en/plan";
import { settings } from "./en/settings";
import { shell } from "./en/shell";
import { therapy } from "./en/therapy";
import { voice } from "./en/voice";
import { welcome } from "./en/welcome";

/**
 * The app's words, one file per screen or feature (DECISIONS 94). Every
 * string written or rewritten since F6 lives here, not in components, so
 * the languages milestone adds a catalog beside `en` instead of hunting
 * through the code. A sentence that carries a value is a function of it.
 */
const en = { checkin, connect, entry, home, plan, settings, shell, therapy, voice, welcome };

export type Messages = typeof en;

/** The catalog. English for now: the app's copy is English (decision 17). */
export const t: Messages = en;
