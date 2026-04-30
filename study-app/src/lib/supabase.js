import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

function createNoopBuilder(label) {
  return {
    insert(payload) {
      console.log(`[study] ${label}.insert`, payload)
      return Promise.resolve({ data: null, error: null })
    },
    update(payload) {
      console.log(`[study] ${label}.update`, payload)
      return Promise.resolve({ data: null, error: null })
    },
    upsert(payload) {
      console.log(`[study] ${label}.upsert`, payload)
      return Promise.resolve({ data: null, error: null })
    },
    eq() {
      return Promise.resolve({ data: null, error: null })
    },
  }
}

function createNoopStorage() {
  return {
    from(bucket) {
      return {
        upload(path, blob, options) {
          console.log(`[study] storage.upload(${bucket})`, { path, size: blob?.size ?? 0, options })
          return Promise.resolve({ data: null, error: null })
        },
        list(path = '') {
          console.log(`[study] storage.list(${bucket})`, { path })
          return Promise.resolve({ data: [], error: null })
        },
        download(path) {
          console.log(`[study] storage.download(${bucket})`, { path })
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[study] Supabase credentials not set. Add VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY to your .env.local file. ' +
    'Client writes will be logged locally until backend wiring is enabled.'
  )
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      from: label => createNoopBuilder(label),
      storage: createNoopStorage(),
    }
