import { Cell } from './Cell'
import { CharStatus } from '../../lib/statuses'

type Props = {
  guess: string
  statuses: CharStatus[]
  setStatus: (position: number, status: CharStatus) => void
}

export const CurrentRow = ({ guess, statuses, setStatus }: Props) => {
  const splitGuess = guess
    .split('')
    .concat(...Array.from(Array(5 - guess.length)))

  return (
    <div className="flex justify-center mb-1">
      {splitGuess.map((letter, i) => (
        <Cell
          key={i}
          value={letter}
          editable={true}
          status={statuses[i]}
          setStatus={(status) => setStatus(i, status)}
        />
      ))}
    </div>
  )
}
