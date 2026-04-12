import { useEffect } from "react";

const BASE_TITLE = "CyNews";

/** Updates the browser tab title to `"<title> | CyNews"` while the component is mounted. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} | ${BASE_TITLE}`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
