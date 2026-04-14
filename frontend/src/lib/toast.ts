import { useSyncExternalStore } from 'react'

export type ToastVariant = 'info' | 'success' | 'error' | 'pending'

export type Toast = {
  id: string
  variant: ToastVariant
  title: string
  message?: string
  /** Optional action link (e.g. "View on Explorer"). */
  action?: { label: string; href: string }
  /** Auto-dismiss in milliseconds; 0 / undefined = sticky. Ignored for pending toasts. */
  duration?: number
}

type Listener = () => void

// ── Minimal external store so toasts work outside React contexts ──

class ToastStore {
  private toasts: Toast[] = []
  private listeners = new Set<Listener>()

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.toasts

  private emit() {
    this.listeners.forEach(l => l())
  }

  push(partial: Omit<Toast, 'id'> & { id?: string }): string {
    const id = partial.id ?? Math.random().toString(36).slice(2)
    const existingIndex = this.toasts.findIndex(t => t.id === id)
    const toast: Toast = { ...partial, id }

    if (existingIndex >= 0) {
      this.toasts = [
        ...this.toasts.slice(0, existingIndex),
        toast,
        ...this.toasts.slice(existingIndex + 1),
      ]
    } else {
      this.toasts = [...this.toasts, toast]
    }
    this.emit()

    if (toast.variant !== 'pending' && (toast.duration ?? 6000) > 0) {
      const ttl = toast.duration ?? 6000
      setTimeout(() => this.dismiss(id), ttl)
    }
    return id
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id)
    this.emit()
  }

  clear() {
    this.toasts = []
    this.emit()
  }
}

const store = new ToastStore()

// ── Public API ──

export const toast = {
  info: (title: string, message?: string, action?: Toast['action']) =>
    store.push({ variant: 'info', title, message, action }),
  success: (title: string, message?: string, action?: Toast['action']) =>
    store.push({ variant: 'success', title, message, action }),
  error: (title: string, message?: string, action?: Toast['action']) =>
    store.push({ variant: 'error', title, message, action }),
  pending: (id: string, title: string, message?: string, action?: Toast['action']) =>
    store.push({ id, variant: 'pending', title, message, action }),
  update: (id: string, partial: Omit<Toast, 'id'>) => store.push({ ...partial, id }),
  dismiss: (id: string) => store.dismiss(id),
  clear: () => store.clear(),
}

export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
