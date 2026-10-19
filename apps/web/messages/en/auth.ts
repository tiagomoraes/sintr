/** Signing in and up, the password, the email address, the consent: the account itself. */
export const auth = {
  signIn: {
    title: "Sign in",
    heading: "Welcome back.",
    lede: "Sign in to open your diary.",
    forgot: "Forgot your password?",
    newHere: "New here?",
    create: "Create your diary",
  },
  signUp: {
    title: "Create your diary",
    heading: "Create your diary.",
    lede: "An email and a password are all it takes. No name, no profile to fill in.",
    /** SINTR_SIGNUP and "open" are the setting and its value, as the self-host docs write them. */
    closed: "Sign-up is closed on this sintr. If it is yours, set SINTR_SIGNUP to open and restart it.",
    already: "Already keeping one?",
    signIn: "Sign in",
  },
  /** The email and password form, for signing in and for creating a diary. */
  form: {
    email: "Email",
    password: "Password",
    passwordHint: "At least 10 characters. A short sentence works well.",
    signIn: "Sign in",
    signUp: "Create your diary",
  },
  /** What Better Auth reports, said plainly. Never echoes what was typed. */
  errors: {
    generic: "Something went wrong. Try again in a moment.",
    tooMany: "Too many attempts. Wait a minute, then try again.",
    mismatch: "That email and password do not match.",
    exists: "There is already a diary for this email. Sign in instead.",
    tooShort: "Use a password of at least 10 characters.",
    tooLong: "Use a password of at most 128 characters.",
    badEmail: "Check the email address.",
    consent: "To keep your diary, sintr needs your consent below.",
    closed: "Sign-up is closed on this sintr.",
  },
  forgot: {
    title: "Forgot your password",
    heading: "A new password.",
    lede: "Write your email and sintr sends you a link to set a new one.",
    noEmail:
      "Email is not set up on this sintr, so it cannot send a link. If it is yours, set up SMTP as described in docs/SELFHOST.md.",
    back: "Back to sign in",
    /** The same answer whether or not the address has a diary. */
    sent: "If there is a diary for that address, a link to set a new password is on its way. It works for an hour.",
    tooMany: "Too many attempts. Wait a few minutes, then try again.",
    send: "Send me a link",
  },
  reset: {
    title: "Set a new password",
    heading: "Set a new password.",
    /** Followed by a link to ask for a new one. */
    expired: "This link has expired or was already used.",
    askAgain: "Ask for a new one",
    /** Followed by a link to sign in. */
    done: "Your password is changed, and every open session was signed out.",
    signIn: "Sign in",
    label: "New password",
    save: "Set the new password",
  },
  /** The account's address in Settings: whether it is confirmed, and a new link on request. */
  email: {
    /** Said after the address itself. */
    confirmed: "is confirmed.",
    notConfirmed: "is not confirmed yet.",
    thanks:
      "Thank you. sintr can now tell you by email when a report is ready, if you ask for it in Therapy.",
    send: "Send the confirmation link",
    sent: "The link is on its way. It works for an hour.",
    failed: "It could not be sent just now. Try again in a few minutes.",
    why: "Needed only for email from sintr, such as a report being ready.",
    unavailable: "Email is not set up on this sintr, so nothing is sent to this address.",
  },
  consent: {
    title: "Before you write",
    heading: "Before you write anything.",
    lede: "A diary like this holds health information, so the law asks for your specific consent, and so do we.",
    missing: "Tick the box to give your consent, or sign out.",
    agree: "I agree, open my diary",
    /**
     * The words a person agrees to (LGPD art. 11), followed by the link to
     * the privacy notice. Every language says exactly this, no more and no
     * less: the consent's version is the same in all of them, and changing
     * the meaning here means a new HEALTH_DATA_CONSENT_VERSION.
     */
    statement:
      "I agree that sintr keeps what I write here, including things about my mental health, so it can keep this diary for me. It is encrypted before it is stored, used for nothing else, and never shared with anyone unless I approve that specific report.",
    privacy: "How sintr handles your data",
  },
} as const;
