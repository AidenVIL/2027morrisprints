// Minimal JSX and React shims for the admin renderer to satisfy TS while deps are not installed
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react' {
  export function useState<T = any>(initial?: T): any;
  export function useEffect(fn: () => void | (() => void), deps?: any[]): any;
  export function useRef<T = any>(initial?: T): any;
  export const Fragment: any;
  const React: any;
  export default React;
}
export {};

declare global {
  interface Window {
    electronAPI?: {
      downloadFile: (url: string, dest: string) => Promise<{ ok: boolean; path: string }>;
      openPath: (path: string) => Promise<string>;
    };
  }
}
