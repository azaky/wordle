import { CompletedRow } from './CompletedRow'
import { CurrentRow } from './CurrentRow'
import { EmptyRow } from './EmptyRow'
import { CharStatus } from '../../lib/statuses'

type Props = {
  guesses: string[]
  currentGuess: string
  currentStatus: CharStatus[]
  setCurrentStatus: (status: CharStatus[]) => void
  feedbacks: CharStatus[][]
}

export const Grid = ({
  guesses,
  currentGuess,
  currentStatus,
  setCurrentStatus,
  feedbacks,
}: Props) => {
  const empties =
    guesses.length < 5 ? Array.from(Array(5 - guesses.length)) : []

  const setCurrentStatusAt = (position: number, status: CharStatus) => {
    const newStatus = [...currentStatus]
    newStatus[position] = status
    setCurrentStatus(newStatus)
  }

  return (
    <div className="pb-6">
      {guesses.map((guess, i) => (
        <CompletedRow key={i} guess={guess} statuses={feedbacks[i]} />
      ))}
      <CurrentRow
        guess={currentGuess}
        statuses={currentStatus}
        setStatus={setCurrentStatusAt}
      />
      {empties.map((_, i) => (
        <EmptyRow key={i} />
      ))}
    </div>
  )
}
