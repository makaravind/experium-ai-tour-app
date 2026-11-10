import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import AudioPanel from '@/components/admin/AudioPanel'
import { audioRow, uploadAudio } from '@/lib/admin/audio'
import type { AdminAudio, AdminExhibit } from '@/lib/admin/types'

const exhibit: AdminExhibit = {
  id: 'ex-1', code: 7, name: 'Banyan', type: null, tier: 'free', status: 'live', description: null,
  facts: [], gps_lat: null, gps_lng: null, section: 'A', number: 1,
}
const enRow: AdminAudio = { exhibit_id: 'ex-1', language: 'en', script: 'Hello', audio_url: 'http://x/en.mp3', status: 'ready' }
const otherRow: AdminAudio = { exhibit_id: 'ex-2', language: 'hi', script: 'other', audio_url: null, status: 'draft' }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('audioRow', () => {
  it('finds the matching row', () => {
    expect(audioRow([otherRow, enRow], 'ex-1', 'en')).toBe(enRow)
  })
  it('returns an empty draft when missing', () => {
    expect(audioRow([enRow], 'ex-1', 'hi')).toEqual({
      exhibit_id: 'ex-1', language: 'hi', script: null, audio_url: null, status: 'draft',
    })
  })
})

describe('uploadAudio', () => {
  it('posts multipart and returns url', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: 'http://x/new.mp3' })))
    vi.stubGlobal('fetch', fetchMock)
    const url = await uploadAudio(7, 'te', new File(['a'], 'a.wav'))
    expect(url).toBe('http://x/new.mp3')
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/api/admin/upload-audio')
    expect(init.body.get('code')).toBe('7')
    expect(init.body.get('lang')).toBe('te')
    expect(init.body.get('file')).toBeInstanceOf(File)
  })
  it('throws server error verbatim', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'ffmpeg exploded' }), { status: 500 })))
    await expect(uploadAudio(7, 'en', new File(['a'], 'a.wav'))).rejects.toThrow('ffmpeg exploded')
  })
  it('falls back to status when body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 502 })))
    await expect(uploadAudio(7, 'en', new File(['a'], 'a.wav'))).rejects.toThrow('Upload failed (502)')
  })
})

describe('AudioPanel', () => {
  it("shows only this exhibit's rows and emits full rows on edit", () => {
    const onChange = vi.fn()
    render(createElement(AudioPanel, { exhibit, audio: [enRow, otherRow], onChange }))
    expect(screen.getByLabelText('en script')).toHaveValue('Hello')
    expect(screen.getByLabelText('hi script')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('hi status'), { target: { value: 'ready' } })
    expect(onChange).toHaveBeenCalledWith({
      exhibit_id: 'ex-1', language: 'hi', script: null, audio_url: null, status: 'ready',
    })
    fireEvent.change(screen.getByLabelText('en script'), { target: { value: 'Hi' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...enRow, script: 'Hi' })
  })

  it('disables upload for a new exhibit', () => {
    render(createElement(AudioPanel, { exhibit: { ...exhibit, code: null }, audio: [], onChange: vi.fn() }))
    expect(screen.getAllByText('Upload audio')[0].closest('button')).toBeDisabled()
    expect(screen.getAllByText('Save the exhibit first')).toHaveLength(3)
  })

  it('uploads, then emits the new url; shows server error inline', async () => {
    const onChange = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'http://x/new.mp3' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'bad file' }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    render(createElement(AudioPanel, { exhibit, audio: [enRow], onChange }))
    fireEvent.change(screen.getByLabelText('en audio file'), { target: { files: [new File(['a'], 'a.wav')] } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ ...enRow, audio_url: 'http://x/new.mp3' }))
    fireEvent.change(screen.getByLabelText('hi audio file'), { target: { files: [new File(['a'], 'b.wav')] } })
    expect(await screen.findByText('bad file')).toBeInTheDocument()
  })
})
