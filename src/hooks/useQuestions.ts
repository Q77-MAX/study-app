import { useState, useCallback, useEffect } from 'react';
import type { Question } from '../types';
import {
  getPracticeQueue,
  updateQuestionMastery,
  addWrongRecord,
  getQuestionCount,
} from '../store/db';
import { getSettings } from '../store/db';

export function useQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const settings = await getSettings();
    const queue = await getPracticeQueue(settings.questionsPerSession);
    setQuestions(queue);
    setCurrentIndex(0);
    setTotalCount(await getQuestionCount());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const currentQuestion = questions[currentIndex] || null;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const isLastQuestion = currentIndex >= questions.length - 1;
  const hasQuestions = questions.length > 0;

  const answerQuestion = useCallback(
    async (userAnswer: string) => {
      if (!currentQuestion) return { isCorrect: false };
      const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.answer.trim().toLowerCase();
      await updateQuestionMastery(currentQuestion.id, isCorrect);
      if (!isCorrect) {
        await addWrongRecord(currentQuestion.id, userAnswer);
      }
      return { isCorrect };
    },
    [currentQuestion],
  );

  const nextQuestion = useCallback(() => {
    if (!isLastQuestion) {
      setCurrentIndex((i) => i + 1);
    }
  }, [isLastQuestion]);

  const resetSession = useCallback(() => {
    loadQuestions();
  }, [loadQuestions]);

  return {
    questions,
    currentQuestion,
    currentIndex,
    totalCount,
    progress,
    isLastQuestion,
    hasQuestions,
    loading,
    answerQuestion,
    nextQuestion,
    resetSession,
  };
}
