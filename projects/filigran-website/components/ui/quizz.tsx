'use client'
import {
  createContext,
  FunctionComponent,
  ReactNode,
  useContext,
  useState,
} from 'react'
import {cn} from '@/utils/utils'
import {Button} from 'filigran-ui/servers'
import {Checkbox} from 'filigran-ui'
import {confettiBasic, confettiSideCannons} from '@/components/ui/confetti'

enum ResponseEnum {
  INIT,
  CORRECT,
  INCORRECT,
}

interface QuizzContextProps {
  onClickAnswer: (answer: string) => void
  selectedAnswers: string[]
  answerState: ResponseEnum
}

const QuizzContext = createContext<QuizzContextProps>({
  onClickAnswer: () => {},
  selectedAnswers: [],
  answerState: ResponseEnum.INIT,
})

const Quizz: FunctionComponent<{children: ReactNode; response: string[]}> = ({
  children,
  response,
}) => {
  const [answerState, setAnswerState] = useState<ResponseEnum>(
    ResponseEnum.INIT
  )
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const onClickAnswer = (answer: string) => {
    setSelectedAnswers((prev) =>
      prev.some((a) => a === answer)
        ? prev.filter((a) => a !== answer)
        : [...prev, answer]
    )
  }

  const onSubmit = () => {
    const isCorrectAnswer =
      selectedAnswers.length === response.length &&
      selectedAnswers.every((a) => response.includes(a))
    setAnswerState(
      isCorrectAnswer ? ResponseEnum.CORRECT : ResponseEnum.INCORRECT
    )
    if (isCorrectAnswer) {
      confettiBasic()
      confettiSideCannons()
    }
  }

  const variantButton = {
    [ResponseEnum.INIT]: 'default',
    [ResponseEnum.CORRECT]: 'secondary',
    [ResponseEnum.INCORRECT]: 'destructive',
  }

  const buttonName = {
    [ResponseEnum.INIT]: 'Submit',
    [ResponseEnum.CORRECT]: 'Correct',
    [ResponseEnum.INCORRECT]: 'Try again',
  }
  return (
    <QuizzContext.Provider
      value={{onClickAnswer, selectedAnswers, answerState}}>
      <div className={'not-prose'}>
        {children}
        <Button
          // @ts-ignore
          variant={variantButton[answerState]}
          className={cn(
            'mt-s',
            answerState === ResponseEnum.INCORRECT && 'bg-red',
            answerState === ResponseEnum.CORRECT && 'bg-green'
          )}
          onClick={onSubmit}>
          {buttonName[answerState]}
        </Button>
      </div>
    </QuizzContext.Provider>
  )
}

const QuizzQuestionChoice = ({
  children,
  id,
}: {
  children: ReactNode
  id: string
}) => {
  const {onClickAnswer, selectedAnswers} = useContext(QuizzContext)
  return (
    <div className="flex items-center space-x-s">
      <Checkbox
        checked={selectedAnswers.some((a) => a === id)}
        onClick={() => onClickAnswer(id)}
      />
      <label htmlFor={id}>{children}</label>
    </div>
  )
}

const QuizzExplanation = ({children}: {children: ReactNode}) => {
  const {answerState} = useContext(QuizzContext)
  return (
    <div
      className={cn(
        'my-s w-fit rounded border border-primary bg-primary/10 p-s',
        answerState !== ResponseEnum.CORRECT && 'hidden'
      )}>
      <div className="txt-category">Explanation :</div>
      {children}
    </div>
  )
}
export {Quizz, QuizzQuestionChoice, QuizzExplanation}
