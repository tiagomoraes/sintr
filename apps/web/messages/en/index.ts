import { auth } from "./auth";
import { checkin } from "./checkin";
import { common } from "./common";
import { connect } from "./connect";
import { crisis } from "./crisis";
import { entry } from "./entry";
import { home } from "./home";
import { language } from "./language";
import { plan } from "./plan";
import { practice } from "./practice";
import { reports } from "./reports";
import { settings } from "./settings";
import { sharing } from "./sharing";
import { shell } from "./shell";
import { talk } from "./talk";
import { therapy } from "./therapy";
import { voice } from "./voice";
import { welcome } from "./welcome";

/**
 * English: the default, and the source every other language is checked
 * against. Each file is one screen or feature (DECISIONS 94); a sentence
 * that carries a value is a function of it.
 */
export const catalog = {
  auth,
  checkin,
  common,
  connect,
  crisis,
  entry,
  home,
  language,
  plan,
  practice,
  reports,
  settings,
  sharing,
  shell,
  talk,
  therapy,
  voice,
  welcome,
};
