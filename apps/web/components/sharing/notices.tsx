import type { NoticeView } from "@sintr/core";
import { cn } from "@sintr/ui";
import { formatDay } from "@/lib/format";
import { noticeText } from "@/lib/sharing";

/** What changed in the account's links lately, the unseen lines marked "New". Words only, no alarm. */
export function Notices({
  notices,
  locale,
  className,
}: {
  notices: readonly NoticeView[];
  locale: { language: string; timezone: string };
  className?: string;
}) {
  if (notices.length === 0) return null;
  return (
    <ul aria-label="What changed" className={cn("space-y-2", className)}>
      {notices.map((notice) => (
        <li
          key={notice.id}
          className="flex items-start gap-3 rounded-file border border-rule bg-wash px-5 py-3 text-[0.9375rem] text-ink-2"
        >
          <span
            aria-hidden="true"
            className={cn(
              "mt-[0.55em] size-[7px] shrink-0 rounded-full",
              notice.readAt ? "border-[1.5px] border-ink-soft" : "bg-ink",
            )}
          />
          <span>
            {notice.readAt ? null : <span className="font-medium text-ink">New. </span>}
            {noticeText(notice)} <span className="text-ink-3">{formatDay(notice.createdAt, locale)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
