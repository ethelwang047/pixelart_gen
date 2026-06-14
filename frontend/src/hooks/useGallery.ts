import { useState, useCallback } from 'react'

export type GalleryItemType = 'sprite' | 'prop' | 'tile' | 'anim'

export interface GalleryItem {
  id: string
  type: GalleryItemType
  name: string
  imageB64: string
  timestamp: number
}

export function useGallery() {
  const [items, setItems] = useState<GalleryItem[]>([])

  const addItem = useCallback((type: GalleryItemType, name: string, imageB64: string) => {
    setItems(prev => [{
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      name,
      imageB64,
      timestamp: Date.now(),
    }, ...prev])
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const clearAll = useCallback(() => setItems([]), [])

  return { items, addItem, removeItem, clearAll }
}
