import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "headline",
            "title",
            "doc-heading",
            "title-small",
            "lede",
            "body",
            "label",
            "caption",
          ],
        },
      ],
    },
  },
});

/** Join class names; later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
