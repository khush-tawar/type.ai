import en from './en.json'

const locale = en

export function t(key, vars = {}) {
  let str = locale[key] ?? key
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v)
  }
  return str
}
