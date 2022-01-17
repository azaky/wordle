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

  // Determine suggestions for the next guess. Things to consider:
  // - words having the most distinct, unused characters
  // - differentiate the feedbacks on top few possible answers
  // - prioritize words having most common characters
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
    let distinctFeedbacks = new Set<number>()
    solutions.slice(0, 40).forEach((solution) => {
      let feedback = 0
      for (let i = 0; i < solution.length; i++) {
        feedback *= 3
        if (solution[i] === word[i]) {
          feedback += 2
        } else {
          feedback += 1
        }
      }
      distinctFeedbacks.add(feedback)
    })
    return { word, unused, distinctFeedbacks: distinctFeedbacks.size }
  })
  const sorted = suggestionsScore.sort((a, b) => {
    if (a.unused !== b.unused) {
      return b.unused - a.unused
    }
    if (a.distinctFeedbacks !== b.distinctFeedbacks) {
      return b.distinctFeedbacks - a.distinctFeedbacks
    }
    return a.word.localeCompare(b.word)
  })

  const suggestions = sorted
    .filter(
      (s) =>
        s.unused === sorted[0].unused &&
        s.distinctFeedbacks === sorted[0].distinctFeedbacks
    )
    .slice(0, suggestionsLimit)
    .map((s) => s.word)

  return {
    solutions,
    suggestions,
  }
}

function App() {
  const [isWinModalOpen, setIsWinModalOpen] = useState(false)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [isWordNotFoundAlertOpen, setIsWordNotFoundAlertOpen] = useState(false)
  const [shareComplete, setShareComplete] = useState(false)

  const [currentGuess, setCurrentGuess] = useState('')
  const [guesses, setGuesses] = useState<string[]>([])

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
        toast.dismiss()
      } else {
        const hints = getHints(guesses, feedbacks)
        setHints(hints)
        showPossibleSolutions(hints)
      }
    }
  }, [guesses, feedbacks])

  const showPossibleSolutions = (
    hints: { solutions: string[]; suggestions: string[] },
    empty: boolean = false,
    solutionsLimit: number = 20
  ) => {
    toast.dismiss()
    if (empty) {
      toast(
        <div>
          <span>
            Please make some guesses before showing possible solutions
          </span>
        </div>
      )
    } else {
      let content = (
        <div>
          <span>No possible solution</span>
        </div>
      )
      const { solutions, suggestions } = hints
      if (solutions.length) {
        const createButton = (word: string, key: number) => (
          <div
            onClick={() => setCurrentGuess(word.toUpperCase())}
            key={key}
            className="inline m-1 p-1 border border-transparent font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <strong className="font-mono">{word}</strong>
          </div>
        )
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
