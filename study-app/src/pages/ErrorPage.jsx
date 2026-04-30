import { t } from '../locales'

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="text-4xl mb-4" aria-hidden>⚠️</div>
        <h1 className="text-lg font-semibold text-slate-800 mb-2">{t('error.heading')}</h1>
        <p className="text-sm text-slate-500 leading-relaxed">{t('error.body')}</p>
      </div>
    </div>
  )
}
