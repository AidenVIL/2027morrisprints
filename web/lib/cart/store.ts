import create from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  id: string; // uuid
  createdAt: string;
  quoteSnapshot: any; // snapshot of quotePreview (includes breakdown + finalPrice)
};

type CartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
};

// Safe storage getter for Next.js hydration
function getStorage() {
  if (typeof window === 'undefined') {
    return {
      getItem: (_: string) => null,
      setItem: (_: string, __: string) => {},
      removeItem: (_: string) => {},
    } as Storage;
  }
  return localStorage;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item: CartItem) => set({ items: [...get().items, item] }),
      removeItem: (id: string) => set({ items: get().items.filter(i => i.id !== id) }),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'morrisprints_cart_v1',
      getStorage: () => getStorage() as any,
    }
  )
);
