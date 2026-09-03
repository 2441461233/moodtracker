// Minimal typing for this optional, test-only browser entry. The app does not
// depend on @types/react-dom; no runtime module or production behavior is added.
declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export function createRoot(container: Element | DocumentFragment): {
    render(children: ReactNode): void;
    unmount(): void;
  };
}
