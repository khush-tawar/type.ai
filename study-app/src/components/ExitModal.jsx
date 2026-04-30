import { t } from '../locales'

export default function ExitModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-heading"
    >
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-6">
          <h2 id="exit-modal-heading" className="text-base font-semibold text-slate-900 mb-2">
            {t('exit_modal.heading')}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {t('exit_modal.body')}
          </p>
        </div>
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button
            onClick={onCancel}
            autoFocus
            className="flex-1 py-2.5 border-2 border-slate-300 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            {t('exit_modal.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {t('exit_modal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
