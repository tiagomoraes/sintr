import type { Catalog } from "../types";
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

/** Português do Brasil: every screen of the English catalog, in the house voice, "você". */
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
} satisfies Catalog;
