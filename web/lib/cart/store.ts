import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : undefined)),
    }
  )
);
