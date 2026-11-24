import { SaveData, defaultSave, validateSave } from './progress'

const DB_NAME = 'mpr-air-hockey'
const STORE = 'kv'

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1)
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE)
    rq.onsuccess = () => res(rq.result)
    rq.onerror = () => rej(rq.error)
  })
}
const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })

export async function kvGet(key: string): Promise<unknown> {
  const db = await open()
  try { return await req(db.transaction(STORE).objectStore(STORE).get(key)) } finally { db.close() }
}
export async function kvSet(key: string, val: unknown): Promise<void> {
  const db = await open()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(val, key)
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })
  } finally { db.close() }
}

/** Load with validation. Corrupt main save -> previous backup -> fresh defaults. */
export async function loadSave(): Promise<{ save: SaveData; recovered: 'none' | 'backup' | 'reset' }> {
  try {
    const main = validateSave(await kvGet('save'))
    if (main) return { save: main, recovered: 'none' }
    const hadMain = (await kvGet('save')) != null
    const bak = validateSave(await kvGet('backup'))
    if (bak) return { save: bak, recovered: 'backup' }
    return { save: defaultSave(), recovered: hadMain ? 'reset' : 'none' }
  } catch {
    return { save: defaultSave(), recovered: 'reset' }
  }
}

/** Atomically keeps the previous good save as a backup, then writes the new one. */
export async function writeSave(save: SaveData): Promise<void> {
  const db = await open()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const st = tx.objectStore(STORE)
    const prev = await req(st.get('save'))
    if (validateSave(prev)) st.put(prev, 'backup')
    st.put(JSON.parse(JSON.stringify(save)), 'save')
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })
  } finally { db.close() }
}

export async function wipeSave(): Promise<void> {
  const db = await open()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
  } finally { db.close() }
}

export async function requestPersistence() {
  try { await navigator.storage?.persist?.() } catch { /* ignore */ }
}
