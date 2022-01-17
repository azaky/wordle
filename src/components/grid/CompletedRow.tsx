import { Cell } from './Cell'
import { CharStatus } from '../../lib/statuses'

type Props = {
  guess: string
  statuses: CharStatus[]
}

export const CompletedRow = ({ guess, statuses }: Props) => {
  return (
    <div className="flex justify-center mb-1">
      {guess.split('').map((letter, i) => (
        <Cell key={i} value={letter} status={statuses?.[i]} />
      ))}
    </div>
  )
}
