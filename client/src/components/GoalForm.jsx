import { useState } from 'react'
import { FormError, PrimaryButton, SecondaryButton, Segmented, TextField } from './Form.jsx'

export default function GoalForm({ initialGoal, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initialGoal ? initialGoal.title : '')
  const [frequency, setFrequency] = useState(initialGoal ? initialGoal.frequency : 'daily')
  const [timesPerWeek, setTimesPerWeek] = useState((initialGoal && initialGoal.timesPerWeek) || 3)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({ title, frequency, timesPerWeek: frequency === 'weekly' ? timesPerWeek : null })
    } catch (submitError) {
      setError(submitError.message)
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex animate-fade-up flex-col gap-5 rounded-2xl border border-ice-300/15 bg-ink-900/90 p-4 shadow-[0_0_40px_-20px_rgb(174_219_255/0.4)]"
    >
      <TextField
        label="Goal"
        id={`goal-title-${initialGoal ? initialGoal.id : 'new'}`}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Read 20 pages"
        maxLength={80}
        autoFocus
        required
      />
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-steel-300">How often</p>
        <Segmented
          label="How often"
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekly', label: 'Times per week' },
          ]}
        />
      </div>
      {frequency === 'weekly' && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-steel-300">Times per week</p>
          <div
            role="radiogroup"
            aria-label="Times per week"
            className="grid grid-cols-7 rounded-xl border border-white/[0.06] bg-ink-950 p-1"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((count) => (
              <button
                key={count}
                type="button"
                role="radio"
                aria-checked={timesPerWeek === count}
                onClick={() => setTimesPerWeek(count)}
                className={`h-11 rounded-lg text-[15px] font-semibold tabular-nums transition ${
                  timesPerWeek === count
                    ? 'bg-ice-50 text-black shadow-[0_0_16px_-4px_rgb(174_219_255/0.7)]'
                    : 'text-steel-400 active:bg-ink-700'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          <p className="text-xs text-steel-500">Weeks run Monday to Sunday.</p>
        </div>
      )}
      <FormError message={error} />
      <div className="flex gap-3">
        <SecondaryButton type="button" onClick={onCancel} className="flex-1">
          Cancel
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={submitting} className="flex-1">
          {submitting ? 'Saving…' : submitLabel}
        </PrimaryButton>
      </div>
    </form>
  )
}
