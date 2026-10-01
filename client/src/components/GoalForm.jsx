import { useState } from 'react'
import { FormError, PrimaryButton, SecondaryButton, Segmented, TextField } from './Form.jsx'

export default function GoalForm({ initialGoal, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initialGoal ? initialGoal.title : '')
  const [frequency, setFrequency] = useState(initialGoal ? initialGoal.frequency : 'daily')
  const [timesPerWeek, setTimesPerWeek] = useState((initialGoal && initialGoal.timesPerWeek) || 3)
  const [tracking, setTracking] = useState(initialGoal && initialGoal.target !== null ? 'amount' : 'check')
  const [target, setTarget] = useState(initialGoal && initialGoal.target !== null ? String(initialGoal.target) : '')
  const [unit, setUnit] = useState(initialGoal && initialGoal.unit ? initialGoal.unit : '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const isAmount = tracking === 'amount'
    const targetNumber = Number(target)
    if (isAmount && (target.trim() === '' || !Number.isFinite(targetNumber) || targetNumber <= 0)) {
      setError('Enter a target above 0')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        title,
        frequency,
        timesPerWeek: frequency === 'weekly' && !isAmount ? timesPerWeek : null,
        target: isAmount ? targetNumber : null,
        unit: isAmount ? unit : null,
      })
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
            { value: 'weekly', label: tracking === 'amount' ? 'Per week' : 'Times per week' },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-steel-300">Track it by</p>
        <Segmented
          label="Track it by"
          value={tracking}
          onChange={setTracking}
          options={[
            { value: 'check', label: 'Check off' },
            { value: 'amount', label: 'Amount' },
          ]}
        />
      </div>
      {tracking === 'amount' && (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={frequency === 'weekly' ? 'Target per week' : 'Target per day'}
            id={`goal-target-${initialGoal ? initialGoal.id : 'new'}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={frequency === 'weekly' ? '20' : '8'}
            required
          />
          <TextField
            label="Unit"
            id={`goal-unit-${initialGoal ? initialGoal.id : 'new'}`}
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder={frequency === 'weekly' ? 'miles' : 'glasses'}
            maxLength={16}
          />
        </div>
      )}
      {tracking === 'amount' && frequency === 'weekly' && (
        <p className="-mt-2 text-xs text-steel-500">Log any day; the week counts once the total reaches the target. Weeks run Monday to Sunday.</p>
      )}
      {frequency === 'weekly' && tracking === 'check' && (
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
