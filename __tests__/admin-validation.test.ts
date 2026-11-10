import { describe, it, expect } from 'vitest'
import { parseFacts, unplacedMessage, validateNumber } from '@/lib/admin/validation'

const ex = (id: string, section: string | null, number: number | null) => ({ id, section, number })

describe('parseFacts', () => {
  it('accepts a valid list and an empty list', () => {
    expect(parseFacts('[{"fact":"a"},{"fact":"b"}]')).toEqual({ ok: true, value: [{ fact: 'a' }, { fact: 'b' }] })
    expect(parseFacts('[]')).toEqual({ ok: true, value: [] })
  })

  it('reports JSON syntax errors', () => {
    const r = parseFacts('[{"fact":')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/^Invalid JSON/)
  })

  it('rejects non-arrays', () => {
    expect(parseFacts('{"fact":"a"}')).toEqual({ ok: false, error: 'Must be a JSON array' })
  })

  it('rejects items that are not objects', () => {
    expect(parseFacts('["a"]').ok).toBe(false)
    expect(parseFacts('[null]').ok).toBe(false)
    expect(parseFacts('[[]]').ok).toBe(false)
  })

  it('rejects missing, non-string or blank fact, naming the item', () => {
    expect(parseFacts('[{"fact":"a"},{}]')).toEqual({ ok: false, error: 'Item 1: "fact" must be a non-empty string' })
    expect(parseFacts('[{"fact":1}]').ok).toBe(false)
    expect(parseFacts('[{"fact":"  "}]').ok).toBe(false)
  })

  it('drops extra keys', () => {
    expect(parseFacts('[{"fact":"a","x":1}]')).toEqual({ ok: true, value: [{ fact: 'a' }] })
  })
})

describe('validateNumber', () => {
  const self = { id: '1', section: 'A' }
  const list = [ex('1', 'A', 1), ex('2', 'A', 2), ex('3', 'B', 3)]

  it('accepts a free positive integer', () => {
    expect(validateNumber('5', self, list)).toEqual({ ok: true, value: 5 })
    expect(validateNumber(' 4 ', self, list)).toEqual({ ok: true, value: 4 })
  })

  it('accepts its own current number', () => {
    expect(validateNumber('1', self, list)).toEqual({ ok: true, value: 1 })
  })

  it('rejects a number used by another exhibit in the same section', () => {
    expect(validateNumber('2', self, list)).toEqual({ ok: false, error: 'Number 2 is already used in section A' })
  })

  it('allows the same number in another section', () => {
    expect(validateNumber('3', self, list)).toEqual({ ok: true, value: 3 })
  })

  it.each(['', 'abc', '0', '-1', '1.5', '1e2'])('rejects %j', (t) => {
    expect(validateNumber(t, self, list).ok).toBe(false)
  })
})

describe('unplacedMessage', () => {
  const e = (name: string, section: string | null, number: number | null) => ({ name, section, number })

  it('returns null when all exhibits are placed', () => {
    expect(unplacedMessage([e('Banyan', 'A', 1), e('Pond', 'B', 2)])).toBeNull()
    expect(unplacedMessage([])).toBeNull()
  })

  it('counts and names exhibits missing section or number', () => {
    expect(unplacedMessage([e('Banyan', 'A', 1), e('Pond', null, null), e('', 'B', null)])).toBe(
      '2 unplaced exhibit(s): fix before saving (Pond, Untitled exhibit)',
    )
  })
})
