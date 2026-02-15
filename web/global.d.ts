// Temporary global declarations to unblock TypeScript until dependencies are installed
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

// minimal next/server shim
declare module 'next/server' {
  export const NextResponse: any;
}

declare module 'stripe' {
  const Stripe: any;
  export default Stripe;
}

// minimal react named exports used in our code
declare module 'react' {
  export function useState<T = any>(initial?: T): any;
  export function useEffect(fn: () => void | (() => void), deps?: any[]): any;
  export function useRef<T = any>(initial?: T): any;
  export function useContext(ctx: any): any;
  export const Fragment: any;
  const React: any;
  export default React;
}

declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: any }

declare module 'react-hook-form' { export function useForm(...args: any[]): any }
declare module 'zod' { export const z: any; export type ZodTypeAny = any }
declare module '@hookform/resolvers/zod' { export const zodResolver: any }
