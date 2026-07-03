import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn's standard class-merge helper: clsx for conditionals, tailwind-merge
// to de-duplicate conflicting Tailwind utilities (last one wins).
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
