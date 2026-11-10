import { supabase } from '@/lib/supabase'
import type { TileManifest, TourEdge, TourGraph, TourNode } from '@/lib/tour'

export async function fetchTourGraph(): Promise<TourGraph> {
  const [nodes, edges] = await Promise.all([
    supabase.from('tour_nodes').select('*'),
    supabase.from('tour_edges').select('*'),
  ])
  if (nodes.error) throw nodes.error
  if (edges.error) throw edges.error
  return { nodes: nodes.data as TourNode[], edges: edges.data as TourEdge[] }
}

export async function fetchManifest(url: string): Promise<TileManifest> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`manifest ${res.status}`)
  return res.json()
}

/** Resolves once the image is fetched (and cached), rejects on error. */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`image ${url}`))
    img.src = url
  })
}
