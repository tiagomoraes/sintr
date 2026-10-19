"use client";

import { Button } from "@sintr/ui";
import { usePathname } from "next/navigation";
import {
  createContext,
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { useLanguage, useMessages } from "@/components/language";
import { formatList } from "@/lib/format";
import { changedFields, fieldsOf, leavesPage, type Fields } from "@/lib/unsaved";
import { useLatest } from "@/lib/use-latest";

/**
 * Nothing leaves a page unsaved (DECISIONS 113). A form on the page says
 * what its fields are called (`useUnsaved`); the diary's shell holds them
 * and, while one of them holds a change that is not saved, asks before
 * every way out: a link anywhere on the page, a form that would load
 * another page, the browser's back and forward (where the browser lets a
 * page ask), signing out, and closing or reloading the tab (the browser's
 * own question, the only one a page may give there). A page with nothing
 * unsaved is never interrupted, and listens for none of it.
 */

/** What a form's changed fields are called in the question: one name for the whole form, or one per field. */
type Parts = string | Readonly<Record<string, string>>;

interface Watched {
  /** The fields as they stand saved: as the page brought them, then as each save sent them. */
  saved: Fields;
  /** As the page brought them, for the fields a form empties once it has saved (a key). */
  initial: Fields;
  /** What the last submit sent, until the form says it was saved; never the emptied fields. */
  sent: Fields | null;
  parts: () => Parts;
  emptied: readonly string[];
}

/** The Navigation API's `navigate` event, as far as the guard reads it (TypeScript's DOM types lack it). */
interface NavigateEvent extends Event {
  navigationType: "push" | "replace" | "reload" | "traverse";
  destination: { key: string; url: string };
}

interface Navigation extends EventTarget {
  traverseTo(key: string): { committed: Promise<unknown>; finished: Promise<unknown> };
}

const ignore = () => undefined;

function without(fields: Fields, names: readonly string[]): Fields {
  return new Map([...fields].filter(([name]) => !names.includes(name)));
}

/**
 * The fields as the form was given them (its own defaults), whatever was
 * ticked or typed since: a page the server sent can be changed before it
 * has come alive (on a slow phone that can be a second), and a change made
 * then is still unsaved. React writes the same defaults when it renders a
 * form itself, except the chosen option of a select it holds in state,
 * which is then read as it is.
 */
function defaultsOf(form: HTMLFormElement): Fields {
  const entries: [string, string][] = [];
  for (const element of form.elements) {
    if (!("name" in element) || !element.name || element.matches(":disabled")) continue;
    if (element instanceof HTMLInputElement) {
      if (["submit", "button", "reset", "image", "file"].includes(element.type)) continue;
      if (element.type !== "checkbox" && element.type !== "radio")
        entries.push([element.name, element.defaultValue]);
      else if (element.defaultChecked) entries.push([element.name, element.value]);
    } else if (element instanceof HTMLSelectElement) {
      const options = [...element.options];
      const given = options.filter((option) => option.defaultSelected);
      const chosen = given.length > 0 ? given : options.filter((option) => option.selected);
      for (const option of element.multiple ? chosen : chosen.slice(-1))
        entries.push([element.name, option.value]);
    } else if (element instanceof HTMLTextAreaElement) {
      entries.push([element.name, element.defaultValue]);
    }
  }
  return fieldsOf(entries);
}

function createGuard(show: (what: string[] | null) => void, setDirty: (dirty: boolean) => void) {
  const forms = new Map<HTMLFormElement, Watched>();
  /** Addresses a page that moves within itself still is (`useStaysOnPage`): going there is not a way out. */
  const pages = new Set<(to: URL) => boolean>();
  const staysOn = (href: string) => {
    const to = new URL(href, window.location.href);
    return [...pages].some((stays) => stays(to));
  };
  /**
   * The person chose to leave: nothing asks again until they change
   * something, or the page or its forms start over.
   */
  let released = false;
  let asking: Promise<boolean> | null = null;
  let answer: ((leave: boolean) => void) | null = null;
  let opener: Element | null = null;

  /** What is not saved, in the page's order, as the question names it; `except` is a form being sent. */
  function unsaved(except?: HTMLFormElement): string[] {
    const said: string[] = [];
    const watched = [...forms]
      .filter(([form]) => form !== except && form.isConnected)
      .sort(([a], [b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    for (const [form, { saved, parts }] of watched) {
      const named = parts();
      for (const name of changedFields(saved, fieldsOf(new FormData(form)))) {
        const part = typeof named === "string" ? named : named[name];
        if (part && !said.includes(part)) said.push(part);
      }
    }
    return said;
  }

  function recheck() {
    setDirty(unsaved().length > 0);
  }

  function ask(what: string[]): Promise<boolean> {
    if (asking) return asking;
    opener = document.activeElement;
    asking = new Promise((resolve) => {
      answer = resolve;
    });
    show(what);
    return asking;
  }

  /** The dialog closed: to leave, or to stay (its Stay button, Escape, a tap beside it). */
  function answered(leave: boolean) {
    const resolve = answer;
    answer = null;
    asking = null;
    if (leave) released = true;
    show(null);
    // Back where the person was; the browser usually does this itself as the dialog closes.
    if (!leave && opener instanceof HTMLElement && opener.isConnected && document.activeElement !== opener) {
      opener.focus({ preventScroll: true });
    }
    resolve?.(leave);
  }

  function mayLeave(): Promise<boolean> {
    const what = released ? [] : unsaved();
    return what.length > 0 ? ask(what) : Promise.resolve(true);
  }

  function watch(form: HTMLFormElement, parts: () => Parts, emptied: readonly string[]): () => void {
    const initial = defaultsOf(form);
    const entry: Watched = { initial, saved: initial, sent: null, parts, emptied };
    forms.set(form, entry);
    // A form that starts over (the page opened again at another address) is a new page to guard.
    released = false;
    const changed = () => {
      released = false;
      recheck();
    };
    const sending = () => {
      entry.sent = without(fieldsOf(new FormData(form)), emptied);
    };
    form.addEventListener("input", changed);
    form.addEventListener("change", changed);
    form.addEventListener("submit", sending);
    return () => {
      form.removeEventListener("input", changed);
      form.removeEventListener("change", changed);
      form.removeEventListener("submit", sending);
      forms.delete(form);
      recheck();
    };
  }

  /** The form's save went through: what it sent is now what stands. */
  function saved(form: HTMLFormElement) {
    const entry = forms.get(form);
    if (!entry) return;
    const now = new Map(entry.sent ?? fieldsOf(new FormData(form)));
    for (const name of entry.emptied) {
      const was = entry.initial.get(name);
      if (was) now.set(name, [...was]);
      else now.delete(name);
    }
    entry.saved = now;
    entry.sent = null;
    recheck();
  }

  /** A page that moves within itself: these addresses are still it. */
  function stays(page: (to: URL) => boolean): () => void {
    pages.add(page);
    return () => void pages.delete(page);
  }

  /** Another page: whatever was let go there is over. */
  function rearm() {
    released = false;
  }

  /** Every way out of the page, while something on it is unsaved. */
  function listen(): () => void {
    const onClick = (event: MouseEvent) => {
      if (released || event.defaultPrevented || !(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const click = {
        href: link.href,
        target: link.target,
        download: link.hasAttribute("download"),
        button: event.button,
        modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
      };
      if (!leavesPage(click, window.location.href) || staysOn(link.href)) return;
      const what = unsaved();
      if (what.length === 0) return;
      // Before the link's own handler (Next's router) sees the click; it is played again to leave.
      event.preventDefault();
      event.stopImmediatePropagation();
      void ask(what).then((leave) => {
        if (!leave) return;
        if (link.isConnected) link.click();
        else window.location.assign(link.href);
      });
    };
    // A form that says it leaves the page (`data-leaves`): asked before React runs its action.
    const onLeavingSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (released || !(form instanceof HTMLFormElement) || !("leaves" in form.dataset)) return;
      const what = unsaved(form);
      if (what.length === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const submitter = event.submitter;
      void ask(what).then((leave) => {
        if (leave) form.requestSubmit(submitter);
      });
    };
    // A plain form the browser itself sends (no script took it over) loads another page.
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (released || event.defaultPrevented || !(form instanceof HTMLFormElement)) return;
      if (form.method === "dialog" || (form.target !== "" && form.target !== "_self")) return;
      // What the form sends is saved by sending it; only the rest would be lost.
      const what = unsaved(form);
      if (what.length === 0) {
        released = true;
        return;
      }
      event.preventDefault();
      const submitter = event.submitter;
      void ask(what).then((leave) => {
        if (leave) form.requestSubmit(submitter);
      });
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (released || unsaved().length === 0) return;
      event.preventDefault();
      // Browsers before 2023 ask only when this is set.
      event.returnValue = true;
    };
    // Back and forward within the app: asked first, where the browser lets a page cancel them.
    const navigation = (window as Window & { navigation?: Navigation }).navigation;
    const onNavigate = (event: Event) => {
      const navigate = event as NavigateEvent;
      if (released || navigate.navigationType !== "traverse" || !navigate.cancelable) return;
      if (staysOn(navigate.destination.url)) return;
      const what = unsaved();
      if (what.length === 0) return;
      navigate.preventDefault();
      const key = navigate.destination.key;
      void ask(what).then((leave) => {
        if (!leave || !navigation) return;
        const going = navigation.traverseTo(key);
        going.committed.catch(ignore);
        going.finished.catch(ignore);
      });
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("submit", onLeavingSubmit, true);
    window.addEventListener("submit", onSubmit);
    window.addEventListener("beforeunload", onBeforeUnload);
    navigation?.addEventListener("navigate", onNavigate);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("submit", onLeavingSubmit, true);
      window.removeEventListener("submit", onSubmit);
      window.removeEventListener("beforeunload", onBeforeUnload);
      navigation?.removeEventListener("navigate", onNavigate);
    };
  }

  return { watch, saved, recheck, mayLeave, answered, rearm, listen, stays };
}

type Guard = ReturnType<typeof createGuard>;

const GuardContext = createContext<Guard | null>(null);

/**
 * The guard and its question, for the diary's shell. The question is a
 * native modal dialog in the page's language: one sentence that says what
 * would be lost, Stay first and in ink, then Leave without saving. Escape
 * or a tap beside it stays, and focus goes back where it was.
 */
export function UnsavedGuard({ children }: { children: ReactNode }) {
  const t = useMessages().shell.unsaved;
  const language = useLanguage().code;
  const pathname = usePathname();
  const [what, setWhat] = useState<string[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [guard] = useState(() => createGuard(setWhat, setDirty));
  const dialog = useRef<HTMLDialogElement>(null);
  const sentence = useId();

  useEffect(() => (dirty ? guard.listen() : undefined), [guard, dirty]);
  useEffect(() => guard.rearm(), [guard, pathname]);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!what || !element || element.open) return;
    element.returnValue = "";
    element.showModal();
  }, [what]);

  return (
    <GuardContext value={guard}>
      {children}
      <dialog
        ref={dialog}
        role="alertdialog"
        aria-labelledby={sentence}
        className="sintr-ask"
        onClose={() => guard.answered(dialog.current?.returnValue === "leave")}
        onClick={(event) => {
          // A tap on the backdrop (beside the question) stays.
          if (event.target === dialog.current) dialog.current.close("stay");
        }}
      >
        <div className="sintr-ask__body">
          <p id={sentence} className="font-serif text-title-small text-ink">
            {what ? t.changes(formatList(what, language)) : null}
          </p>
          <div className="sintr-ask__actions">
            <Button type="button" onClick={() => dialog.current?.close("stay")}>
              {t.stay}
            </Button>
            <Button type="button" variant="outline" onClick={() => dialog.current?.close("leave")}>
              {t.leave}
            </Button>
          </div>
        </div>
      </dialog>
    </GuardContext>
  );
}

const NONE: readonly string[] = [];

/**
 * Keep a form in the guard while it is on the page. `parts` is what its
 * changed fields are called in the question; `saved` is the form's answer
 * after a save that went through (a new value each time, null otherwise),
 * when what it sent becomes what stands; `emptied` are fields the form
 * empties once saved (a key), which are unsaved only while they hold
 * something.
 */
export function useUnsaved(
  form: RefObject<HTMLFormElement | null>,
  parts: Parts,
  saved: object | null,
  emptied: readonly string[] = NONE,
): void {
  const guard = use(GuardContext);
  const named = useLatest(parts);
  useEffect(() => {
    const element = form.current;
    if (!guard || !element) return;
    return guard.watch(element, () => named.current, emptied);
  }, [guard, form, named, emptied]);
  // A field held in state (a preset, the device's zone) changes without an input event.
  useEffect(() => {
    guard?.recheck();
  });
  useEffect(() => {
    if (guard && saved && form.current) guard.saved(form.current);
  }, [guard, form, saved]);
}

/** A form the server renders whole (it posts without JavaScript), kept in the guard as `part`. */
export function UnsavedForm({ part, ...props }: ComponentProps<"form"> & { part: string }) {
  const form = useRef<HTMLFormElement>(null);
  useUnsaved(form, part, null);
  return <form ref={form} {...props} />;
}

/**
 * A page whose state lives in its address and moves without loading again
 * (Therapy's calendar: `?month=`, `?session=`) says which addresses are still
 * itself. A link or a step back and forward between them keeps every form on
 * the page as it is, so it is not a way out and is never asked about.
 */
export function useStaysOnPage(stays: (to: URL) => boolean): void {
  const guard = use(GuardContext);
  const latest = useLatest(stays);
  useEffect(() => guard?.stays((to) => latest.current(to)), [guard, latest]);
}

const leaveFreely = () => Promise.resolve(true);

/** For a way out that is neither a link nor a form (signing out): true when the person may go. */
export function useMayLeave(): () => Promise<boolean> {
  return use(GuardContext)?.mayLeave ?? leaveFreely;
}
