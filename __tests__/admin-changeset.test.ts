import { describe, it, expect } from 'vitest'
import { buildChangeset } from '@/lib/admin/changeset'
import type {
  AdminAmenity, AdminAudio, AdminExhibit, AdminPhoto, AdminState, Section, WorkingSection, WorkingState,
} from '@/lib/admin/types'

const sq = (x: number): [number, number][] => [[x, 0], [x + 10, 0], [x + 10, 10], [x, 10]]

const exhibit = (over: Partial<AdminExhibit> = {}): AdminExhibit => ({
  id: 'e1', code: 1, name: 'Baobab', type: 'plant', tier: 'silver', status: 'live',
  description: null, facts: [{ fact: 'old' }], gps_lat: 5, gps_lng: 5, section: 'A', number: 1,
  ...over,
})
const amenity = (over: Partial<AdminAmenity> = {}): AdminAmenity => ({
  id: 'a1', name: 'Main Washroom', type: 'washroom', description: null, gps_lat: 5, gps_lng: 5, section: 'A', ...over,
})
const audio = (over: Partial<AdminAudio> = {}): AdminAudio => ({
  exhibit_id: 'e1', language: 'en', script: 's', audio_url: 'u1', status: 'draft', ...over,
})
const photo = (over: Partial<AdminPhoto> = {}): AdminPhoto => ({
  id: 'p1', exhibit_id: 'e1', url: 'x.webp', caption: null, is_hero: true, sort_order: 0, ...over,
})

const original = (): AdminState => ({
  sections: [{ id: 'A', polygon: sq(0) }, { id: 'B', polygon: sq(20) }],
  exhibits: [exhibit(), exhibit({ id: 'e2', code: 2, number: 2 })],
  audio: [audio()],
  photos: [photo()],
  amenities: [amenity()],
})

/** Working copy of `original()` as the client would load it. */
const working = (o: AdminState = original()): WorkingState => ({
  ...structuredClone(o),
  sections: o.sections.map((s): WorkingSection => ({ ...structuredClone(s), originalId: s.id })),
})

const empty = {
  sections: { rename: [], upsert: [], delete: [] },
  exhibits: [],
  audio: [],
  photos: { insert: [], update: [], delete: [] },
  amenities: { upsert: [], delete: [] },
}

describe('buildChangeset', () => {
  it('no edits → empty changeset, empty summary', () => {
    const r = buildChangeset(original(), working())
    expect(r.changeset).toEqual(empty)
    expect(r.isEmpty).toBe(true)
    expect(r.summary).toBe('')
  })

  describe('exhibits', () => {
    it('gps change within a section → moved', () => {
      const w = working()
      w.exhibits[0] = { ...w.exhibits[0], gps_lat: 6 }
      const r = buildChangeset(original(), w)
      expect(r.changeset.exhibits).toEqual([{ id: 'e1', gps_lat: 6 }])
      expect(r.summary).toBe('1 moved')
    })

    it('section change → moved, section + number sent together', () => {
      const w = working()
      w.exhibits[0] = { ...w.exhibits[0], section: 'B', number: 1, gps_lng: 25 }
      const r = buildChangeset(original(), w)
      expect(r.changeset.exhibits).toEqual([{ id: 'e1', section: 'B', number: 1, gps_lng: 25 }])
      expect(r.summary).toBe('1 moved')
    })

    it('section change with same number still sends both', () => {
      const w = working()
      w.exhibits[0] = { ...w.exhibits[0], section: 'B' } // number stays 1
      expect(buildChangeset(original(), w).changeset.exhibits).toEqual([{ id: 'e1', section: 'B', number: 1 }])
    })

    it('tier change', () => {
      const w = working()
      w.exhibits[1] = { ...w.exhibits[1], tier: 'gold' }
      const r = buildChangeset(original(), w)
      expect(r.changeset.exhibits).toEqual([{ id: 'e2', tier: 'gold' }])
      expect(r.summary).toBe('1 tier changed')
    })

    it('number change within a section → renumbered', () => {
      const w = working()
      w.exhibits[0] = { ...w.exhibits[0], number: 5 }
      const r = buildChangeset(original(), w)
      expect(r.changeset.exhibits).toEqual([{ id: 'e1', number: 5 }])
      expect(r.summary).toBe('1 renumbered')
    })

    it.each([
      ['name', { name: 'X' }],
      ['type', { type: 'structure' }],
      ['status', { status: 'coming_soon' }],
      ['description', { description: 'd' }],
      ['facts', { facts: [{ fact: 'new' }] }],
    ])('%s change → edited', (_k, patch) => {
      const w = working()
      w.exhibits[0] = { ...w.exhibits[0], ...patch }
      const r = buildChangeset(original(), w)
      expect(r.changeset.exhibits).toEqual([{ id: 'e1', ...patch }])
      expect(r.summary).toBe('1 edited')
    })

    it('new exhibit (not in original) → full row without code, not double-counted', () => {
      const w = working()
      const fresh = exhibit({ id: 'new1', code: null, section: 'A', number: 3 })
      w.exhibits.push(fresh)
      const r = buildChangeset(original(), w)
      expect(r.changeset.exhibits).toEqual([{ ...fresh, code: undefined }])
      expect(r.changeset.exhibits[0]).not.toHaveProperty('code')
      expect(r.summary).toBe('1 exhibit added')
    })

    it('one exhibit with several kinds of change counts in each category', () => {
      const w = working()
      w.exhibits[0] = { ...w.exhibits[0], gps_lat: 9, tier: 'gold', name: 'Z' }
      const r = buildChangeset(original(), w)
      expect(r.changeset.exhibits).toEqual([{ id: 'e1', name: 'Z', tier: 'gold', gps_lat: 9 }])
      expect(r.summary).toBe('1 moved, 1 tier changed, 1 edited')
    })

    it('facts compared by value, not reference', () => {
      const w = working()
      w.exhibits[0] = { ...w.exhibits[0], facts: [{ fact: 'old' }] }
      expect(buildChangeset(original(), w).isEmpty).toBe(true)
    })
  })

  describe('sections', () => {
    it('new section → upsert, "section added"', () => {
      const w = working()
      w.sections.push({ id: 'C', polygon: sq(40), originalId: null })
      const r = buildChangeset(original(), w)
      expect(r.changeset.sections.upsert).toEqual([{ id: 'C', polygon: sq(40) }])
      expect(r.changeset.sections.rename).toEqual([])
      expect(r.summary).toBe('1 section added')
    })

    it('reshaped polygon → upsert, "reshaped"', () => {
      const w = working()
      w.sections[0].polygon = [...sq(0), [0, 5]]
      const r = buildChangeset(original(), w)
      expect(r.changeset.sections.upsert).toEqual([{ id: 'A', polygon: w.sections[0].polygon }])
      expect(r.summary).toBe('1 section reshaped')
    })

    it('rename only → rename entry, no upsert; exhibits relabelled by the rename are not changes', () => {
      const w = working()
      w.sections[0].id = 'Z'
      w.exhibits = w.exhibits.map((e) => (e.section === 'A' ? { ...e, section: 'Z' } : e))
      w.amenities = w.amenities.map((a) => (a.section === 'A' ? { ...a, section: 'Z' } : a))
      const r = buildChangeset(original(), w)
      expect(r.changeset.sections.rename).toEqual([{ from: 'A', to: 'Z' }])
      expect(r.changeset.sections.upsert).toEqual([])
      expect(r.changeset.exhibits).toEqual([])
      expect(r.changeset.amenities).toEqual({ upsert: [], delete: [] })
      expect(r.summary).toBe('1 section renamed')
    })

    it('rename + reshape → both, upsert uses new id', () => {
      const w = working()
      w.sections[0].id = 'Z'
      w.sections[0].polygon = sq(1)
      w.exhibits = w.exhibits.map((e) => (e.section === 'A' ? { ...e, section: 'Z' } : e))
      w.amenities = w.amenities.map((a) => (a.section === 'A' ? { ...a, section: 'Z' } : a))
      const r = buildChangeset(original(), w)
      expect(r.changeset.sections.rename).toEqual([{ from: 'A', to: 'Z' }])
      expect(r.changeset.sections.upsert).toEqual([{ id: 'Z', polygon: sq(1) }])
      expect(r.summary).toBe('1 section renamed, 1 section reshaped')
    })

    it('removed section → delete', () => {
      const w = working()
      w.exhibits = w.exhibits.filter((e) => e.section !== 'B')
      w.sections = w.sections.filter((s) => s.id !== 'B')
      const r = buildChangeset(original(), w)
      expect(r.changeset.sections.delete).toEqual(['B'])
      expect(r.summary).toBe('1 section deleted')
    })

    it('deleted letter re-drawn as a new section → upsert, no delete', () => {
      const w = working()
      w.sections = [w.sections[0], { id: 'B', polygon: sq(50), originalId: null }]
      const r = buildChangeset(original(), w)
      expect(r.changeset.sections.delete).toEqual([])
      expect(r.changeset.sections.upsert).toEqual([{ id: 'B', polygon: sq(50) }])
    })

    it('plural counts', () => {
      const w = working()
      w.sections.push({ id: 'C', polygon: sq(40), originalId: null }, { id: 'D', polygon: sq(60), originalId: null })
      expect(buildChangeset(original(), w).summary).toBe('2 sections added')
    })
  })

  describe('audio', () => {
    it('existing row → partial, audio_url sent as url', () => {
      const w = working()
      w.audio[0] = { ...w.audio[0], status: 'published', audio_url: 'u2' }
      const r = buildChangeset(original(), w)
      expect(r.changeset.audio).toEqual([{ exhibit_id: 'e1', language: 'en', status: 'published', url: 'u2' }])
      expect(r.summary).toBe('1 audio changed')
    })

    it('script-only change omits url/status', () => {
      const w = working()
      w.audio[0] = { ...w.audio[0], script: 'new script' }
      expect(buildChangeset(original(), w).changeset.audio).toEqual([
        { exhibit_id: 'e1', language: 'en', script: 'new script' },
      ])
    })

    it('url cleared to null is sent explicitly', () => {
      const w = working()
      w.audio[0] = { ...w.audio[0], audio_url: null }
      expect(buildChangeset(original(), w).changeset.audio).toEqual([
        { exhibit_id: 'e1', language: 'en', url: null },
      ])
    })

    it('new language row → full row', () => {
      const w = working()
      w.audio.push(audio({ language: 'hi', script: 'नमस्ते', audio_url: null }))
      const r = buildChangeset(original(), w)
      expect(r.changeset.audio).toEqual([
        { exhibit_id: 'e1', language: 'hi', script: 'नमस्ते', status: 'draft', url: null },
      ])
      expect(r.summary).toBe('1 audio changed')
    })
  })

  describe('photos', () => {
    it('new photo → insert full row', () => {
      const w = working()
      const added = photo({ id: 'p2', is_hero: false, sort_order: 1 })
      w.photos.push(added)
      const r = buildChangeset(original(), w)
      expect(r.changeset.photos).toEqual({ insert: [added], update: [], delete: [] })
      expect(r.summary).toBe('1 photo added')
    })

    it('existing photo → update with only changed keys', () => {
      const w = working()
      w.photos[0] = { ...w.photos[0], caption: 'c', sort_order: 2 }
      const r = buildChangeset(original(), w)
      expect(r.changeset.photos).toEqual({ insert: [], update: [{ id: 'p1', caption: 'c', sort_order: 2 }], delete: [] })
      expect(r.summary).toBe('1 photo changed')
    })

    it('removed photo → delete id', () => {
      const w = working()
      w.photos = []
      const r = buildChangeset(original(), w)
      expect(r.changeset.photos).toEqual({ insert: [], update: [], delete: ['p1'] })
      expect(r.summary).toBe('1 photo removed')
    })
  })

  describe('amenities', () => {
    it('new amenity → full row, summary "amenity added"', () => {
      const w = working()
      const a = amenity({ id: 'a2', name: 'Cafe', type: 'food', description: 'Snacks' })
      w.amenities.push(a)
      const r = buildChangeset(original(), w)
      expect(r.changeset.amenities).toEqual({ upsert: [a], delete: [] })
      expect(r.summary).toBe('1 amenity added')
    })

    it('gps change within a section → gps + section sent, moved', () => {
      const w = working()
      w.amenities[0] = { ...w.amenities[0], gps_lat: 6 }
      const r = buildChangeset(original(), w)
      expect(r.changeset.amenities.upsert).toEqual([{ id: 'a1', gps_lat: 6, section: 'A' }])
      expect(r.summary).toBe('1 amenity moved')
    })

    it('section change → gps + section sent', () => {
      const w = working()
      w.amenities[0] = { ...w.amenities[0], gps_lng: 25, section: 'B' }
      const r = buildChangeset(original(), w)
      expect(r.changeset.amenities.upsert).toEqual([{ id: 'a1', gps_lng: 25, section: 'B' }])
      expect(r.summary).toBe('1 amenity moved')
    })

    it('name / type / description edits → only changed keys, summary "edited"', () => {
      const w = working()
      w.amenities[0] = { ...w.amenities[0], name: 'WC', type: 'gate', description: 'd' }
      const r = buildChangeset(original(), w)
      expect(r.changeset.amenities.upsert).toEqual([{ id: 'a1', name: 'WC', type: 'gate', description: 'd' }])
      expect(r.summary).toBe('1 amenity edited')
    })

    it('removed amenity → delete id', () => {
      const w = working()
      w.amenities = []
      const r = buildChangeset(original(), w)
      expect(r.changeset.amenities).toEqual({ upsert: [], delete: ['a1'] })
      expect(r.summary).toBe('1 amenity deleted')
      expect(r.isEmpty).toBe(false)
    })

    it('unchanged amenities → nothing', () => {
      expect(buildChangeset(original(), working()).changeset.amenities).toEqual({ upsert: [], delete: [] })
    })
  })

  it('summary order matches the spec example', () => {
    const w = working()
    w.exhibits[0] = { ...w.exhibits[0], gps_lat: 9 }
    w.exhibits[1] = { ...w.exhibits[1], gps_lat: 9, tier: 'gold' }
    w.sections.push({ id: 'C', polygon: sq(40), originalId: null } satisfies Section & { originalId: null })
    expect(buildChangeset(original(), w).summary).toBe('2 moved, 1 tier changed, 1 section added')
  })
})
