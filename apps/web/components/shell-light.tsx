"use client";

import { RoomLight, type RoomScene } from "@sintr/ui";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { TimeOfDay } from "@/lib/time-of-day";

/** The home is where the light moves; every other page is read, and keeps it in the header. */
function sceneFor(pathname: string): RoomScene {
  return pathname === "/home" || pathname === "/talk" || pathname.startsWith("/talk/") ? "home" : "reading";
}

const SceneContext = createContext<(scene: RoomScene | null) => void>(() => undefined);

/**
 * The room the diary sits in: the person's time of day (the light's
 * colours) and the window light, placed by the page. A page may move the
 * light for a moment (`useRoomScene`), as the home does while it listens.
 */
export function ShellLight({ time, children }: { time: TimeOfDay; children: ReactNode }) {
  const pathname = usePathname();
  const [moved, setMoved] = useState<{ path: string; scene: RoomScene } | null>(null);
  // A scene a page chose holds only on that page.
  const scene = moved && moved.path === pathname ? moved.scene : sceneFor(pathname);
  const choose = useCallback(
    (next: RoomScene | null) =>
      setMoved((current) => {
        if (!next) return current === null ? current : null;
        return current?.path === pathname && current.scene === next
          ? current
          : { path: pathname, scene: next };
      }),
    [pathname],
  );
  return (
    <div data-time={time} className="relative">
      <RoomLight scene={scene} />
      <SceneContext.Provider value={choose}>
        <div className="relative z-10">{children}</div>
      </SceneContext.Provider>
    </div>
  );
}

/** Move the room's light while this component shows `scene`; null leaves it to the page. */
export function useRoomScene(scene: RoomScene | null): void {
  const set = useContext(SceneContext);
  useEffect(() => {
    set(scene);
  }, [scene, set]);
  useEffect(() => () => set(null), [set]);
}
