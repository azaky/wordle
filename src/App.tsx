import {
  RefreshIcon,
  LightBulbIcon,
  ReplyIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/solid'
import { useState, useEffect } from 'react'
import { Alert } from './components/alerts/Alert'
import { Grid } from './components/grid/Grid'
import { Keyboard } from './components/keyboard/Keyboard'
import { AboutModal } from './components/modals/AboutModal'
import { InfoModal } from './components/modals/InfoModal'
import { WinModal } from './components/modals/WinModal'
import { isWordInWordList, validSolutions, validGuesses } from './lib/words'
import { CharStatus, getStatusesFromFeedbacks } from './lib/statuses'
import { ToastContainer, toast } from 'react-toastify'

import 'react-toastify/dist/ReactToastify.css'

// Determine suggestions for the next guess. Things to consider:
// - minimize the max size of set of solutions after the next feedback
// - words having the most distinct, unused characters
const getSuggestions = (
  solutions: string[],
  charStatuses: { [key: string]: CharStatus },
  suggestionsLimit: number,
  deviation: { maxSolutionSize: number; unused: number } = {
    maxSolutionSize: 3,
    unused: 0,
  }
) => {
  const suggestionsScore = validGuesses.map((word) => {
    let unused = 0
    let usedChars = new Set<string>()
    word.split('').forEach((char) => {
      if (usedChars.has(char)) {
        return
      }
      usedChars.add(char)
      if (!charStatuses[char.toUpperCase()]) {
        unused++
      }
    })
    let solutionsSize: number[] = []
    solutions.forEach((solution) => {
      let feedback = 0
      let correctChar = new Set<string>()
      let solutionChar = new Set<string>()
      for (let i = 0; i < solution.length; i++) {
        if (solution[i] === word[i]) {
          feedback += 2 * 3 ** i
          correctChar.add(word[i])
        }
        solutionChar.add(solution[i])
      }
      for (let i = 0; i < solution.length; i++) {
        if (solution[i] !== word[i]) {
          if (!correctChar.has(word[i]) && solutionChar.has(word[i])) {
            feedback += 3 ** i
          }
        }
      }
      if (!solutionsSize[feedback]) {
        solutionsSize[feedback] = 1
      } else {
        solutionsSize[feedback]++
      }
    })
    let maxSolutionsSize = 0
    for (let size of solutionsSize) {
      if (size > maxSolutionsSize) {
        maxSolutionsSize = size
      }
    }
    return {
      word,
      unused,
      maxSolutionsSize,
    }
  })
  const sorted = suggestionsScore.sort((a, b) => {
    if (a.maxSolutionsSize !== b.maxSolutionsSize) {
      return a.maxSolutionsSize - b.maxSolutionsSize
    }
    if (a.unused !== b.unused) {
      return b.unused - a.unused
    }
    return a.word.localeCompare(b.word)
  })

  const bestSuggestion = sorted[0]
  const acceptableSuggestions = sorted.filter(
    (s) =>
      s.maxSolutionsSize - bestSuggestion.maxSolutionsSize <=
        Math.min(deviation.maxSolutionSize, solutions.length / 10) &&
      bestSuggestion.unused - s.unused <= deviation.unused
  )

  console.log({ suggestions: acceptableSuggestions })

  const suggestions = acceptableSuggestions
    .map((s) => s.word)
    .slice(0, suggestionsLimit)

  return suggestions
}

const getHints = (
  guesses: string[],
  feedbacks: CharStatus[][],
  suggestionsLimit: number = 8
) => {
  const solutions = validSolutions.filter((word) => {
    // Check if each guesses so far match the current word.
    let valid = true
    let hasLetter: { [index: string]: boolean } = {}
    let isCorrectLetter: { [index: string]: boolean } = {}
    for (let i = 0; i < word.length; i++) {
      hasLetter[word[i]] = true
    }
    for (let i = 0; i < guesses.length && valid; i++) {
      const guess = guesses[i].toLowerCase()
      const feedback = feedbacks[i]
      if (guess.length !== feedback.length || guess.length !== word.length) {
        valid = false
        break
      }
      // Process by the order of 'correct', 'present', 'absent'
      for (let j = 0; j < feedback.length && valid; j++) {
        if (feedback[j] === 'correct') {
          if (word[j] !== guess[j]) {
            valid = false
            break
          }
          isCorrectLetter[word[j]] = true
        }
      }
      if (!valid) {
        break
      }

      for (let j = 0; j < feedback.length && valid; j++) {
        if (feedback[j] === 'present') {
          if (!hasLetter[guess[j]] || guess[j] === word[j]) {
            valid = false
            break
          }
        }
      }
      if (!valid) {
        break
      }

      for (let j = 0; j < feedback.length && valid; j++) {
        if (feedback[j] === 'absent') {
          if (hasLetter[guess[j]] && !isCorrectLetter[guess[j]]) {
            valid = false
            break
          }
        }
      }
      if (!valid) {
        break
      }
    }
    return valid
  })

  if (solutions.length <= 1) {
    return { solutions, suggestions: [] }
  }

  const charStatuses = getStatusesFromFeedbacks(guesses, feedbacks)
  const suggestions = getSuggestions(solutions, charStatuses, suggestionsLimit)

  return {
    solutions,
    suggestions,
  }
}

// This is too slow to run on each load, so we hardcode it instead
// const validFirstSuggestions = getSuggestions(validSolutions, {}, 8)
const validFirstSuggestions = [
  'aesir',
  'arise',
  'raise',
  'reais',
  'serai',
  'aiery',
  'ayrie',
]

function App() {
  const [isWinModalOpen, setIsWinModalOpen] = useState(false)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [isWordNotFoundAlertOpen, setIsWordNotFoundAlertOpen] = useState(false)
  const [shareComplete, setShareComplete] = useState(false)

  const [currentGuess, setCurrentGuess] = useState('')
  const [guesses, setGuesses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const emptyStatus = [
    'absent',
    'absent',
    'absent',
    'absent',
    'absent',
  ] as CharStatus[]

  const [currentStatus, setCurrentStatus] = useState<CharStatus[]>(emptyStatus)
  const [feedbacks, setFeedbacks] = useState<CharStatus[][]>([])
  const [hints, setHints] = useState<{
    solutions: string[]
    suggestions: string[]
  }>({ solutions: [], suggestions: [] })

  const onChar = (value: string) => {
    if (currentGuess.length < 5) {
      setCurrentGuess(`${currentGuess}${value}`)
    }
  }

  const onDelete = () => {
    setCurrentGuess(currentGuess.slice(0, -1))
  }

  useEffect(() => {
    if (guesses.length === feedbacks.length) {
      if (!guesses.length) {
        toast.dismiss('hints')
      } else {
        setLoading(true)
        // HACK: We need delay to let the toast show.
        setTimeout(() => {
          const hints = getHints(guesses, feedbacks)
          setLoading(false)
          setHints(hints)
          showPossibleSolutions(hints)
        }, 300)
      }
    }
  }, [guesses, feedbacks])

  useEffect(() => {
    if (loading) {
      toast.loading('Calculating the solutions', {
        toastId: 'loading',
        autoClose: false,
        closeOnClick: false,
        closeButton: false,
        draggable: false,
      })
    } else {
      toast.dismiss('loading')
    }
  }, [loading])

  const showPossibleSolutions = (
    hints: { solutions: string[]; suggestions: string[] },
    empty: boolean = false,
    solutionsLimit: number = 20
  ) => {
    const createButton = (word: string, key: number) => (
      <div
        onClick={() => setCurrentGuess(word.toUpperCase())}
        key={key}
        className="inline m-1 p-1 border border-transparent font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <strong className="font-mono">{word}</strong>
      </div>
    )
    toast.dismiss('hints')
    if (empty) {
      const firstSuggestions = validFirstSuggestions
      toast(
        <div>
          <div>Please make some guesses before showing possible solutions.</div>
          <div className="mt-2">
            <div>Try these as your first guess:</div>
            <div className="flex flex-wrap leading-4">
              {firstSuggestions.map((word, i) => createButton(word, i))}
            </div>
          </div>
        </div>,
        {
          toastId: 'hints',
        }
      )
    } else {
      let content = (
        <div>
          <span>No possible solution</span>
        </div>
      )
      const { solutions, suggestions } = hints
      if (solutions.length) {
        content = (
          <div>
            <div>
              {solutions.length} possible{' '}
              {`solution${solutions.length > 1 ? 's' : ''}`}:
            </div>
            <div className="flex flex-wrap leading-4">
              {solutions
                .slice(0, solutionsLimit)
                .map((word, i) => createButton(word, i))}
              {solutions.length > solutionsLimit && (
                <>
                  <br />
                  and {solutions.length - solutionsLimit} more ...
                </>
              )}
            </div>
            {suggestions.length ? (
              <div className="mt-2">
                <div>Suggestions for next guesses:</div>
                <div className="flex flex-wrap leading-4">
                  {suggestions.map((word, i) => createButton(word, i))}
                </div>
              </div>
            ) : null}
          </div>
        )
      }
      toast(content, {
        autoClose: false,
        toastId: 'hints',
      })
    }
  }

  const reset = () => {
    setGuesses([])
    setFeedbacks([])
    setCurrentGuess('')
    setCurrentStatus(emptyStatus)
  }

  const removeLastGuess = () => {
    if (guesses.length) {
      setGuesses(guesses.slice(0, -1))
      setFeedbacks(feedbacks.slice(0, -1))
      setCurrentGuess(guesses[guesses.length - 1])
      setCurrentStatus(emptyStatus)
    }
  }

  const onEnter = () => {
    if (!isWordInWordList(currentGuess)) {
      setIsWordNotFoundAlertOpen(true)
      return setTimeout(() => {
        setIsWordNotFoundAlertOpen(false)
      }, 2000)
    }

    if (currentGuess.length === 5) {
      setGuesses([...guesses, currentGuess])
      setCurrentGuess('')
      setFeedbacks([...feedbacks, currentStatus])
      setCurrentStatus(emptyStatus)
    }
  }

  return (
    <div className="py-8 max-w-lg mx-auto sm:px-6 lg:px-8">
      <ToastContainer position="top-right" hideProgressBar={true} />
      <Alert message="Word not found" isOpen={isWordNotFoundAlertOpen} />
      <Alert
        message="Game copied to clipboard"
        isOpen={shareComplete}
        variant="success"
      />
      <div className="flex w-80 mx-auto items-center mb-8">
        <h1 className="text-xl grow font-bold">Wordle Solver</h1>
        <QuestionMarkCircleIcon
          className="h-6 w-6 cursor-pointer m-2"
          onClick={() => setIsInfoModalOpen(true)}
        />
        <RefreshIcon
          className="h-6 w-6 cursor-pointer m-2"
          onClick={() => reset()}
        />
        <ReplyIcon
          className="h-6 w-6 cursor-pointer m-2"
          onClick={() => removeLastGuess()}
        />
        <LightBulbIcon
          className="h-6 w-6 cursor-pointer m-2"
          onClick={() => showPossibleSolutions(hints, guesses.length === 0)}
        />
      </div>
      <Grid
        guesses={guesses}
        currentGuess={currentGuess}
        currentStatus={currentStatus}
        setCurrentStatus={setCurrentStatus}
        feedbacks={feedbacks}
      />
      <Keyboard
        onChar={onChar}
        onDelete={onDelete}
        onEnter={onEnter}
        guesses={guesses}
        feedbacks={feedbacks}
      />
      <WinModal
        isOpen={isWinModalOpen}
        handleClose={() => setIsWinModalOpen(false)}
        guesses={guesses}
        handleShare={() => {
          setIsWinModalOpen(false)
          setShareComplete(true)
          return setTimeout(() => {
            setShareComplete(false)
          }, 2000)
        }}
      />
      <InfoModal
        isOpen={isInfoModalOpen}
        handleClose={() => setIsInfoModalOpen(false)}
      />
      <AboutModal
        isOpen={isAboutModalOpen}
        handleClose={() => setIsAboutModalOpen(false)}
      />

      <div className="flex items-center">
        <button
          type="button"
          className="mx-auto mt-8 px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={() => setIsAboutModalOpen(true)}
        >
          About this solver
        </button>
      </div>
    </div>
  )
}

export default App
