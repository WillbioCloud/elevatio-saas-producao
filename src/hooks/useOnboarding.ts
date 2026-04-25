import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type OnboardingState = {
  visited: Record<string, boolean>;
  checklist: string[];
};

const DEFAULT_STATE: OnboardingState = {
  visited: {},
  checklist: ['create-company'],
};

const mergeOnboardingState = (state?: Partial<OnboardingState> | null): OnboardingState => ({
  ...DEFAULT_STATE,
  ...(state || {}),
  visited: {
    ...DEFAULT_STATE.visited,
    ...(state?.visited || {}),
  },
  checklist: Array.isArray(state?.checklist) ? state.checklist : DEFAULT_STATE.checklist,
});

export function useOnboarding() {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchState = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_state')
        .eq('id', user.id)
        .single();

      if (!error && data?.onboarding_state) {
        setState(mergeOnboardingState(data.onboarding_state as Partial<OnboardingState>));
      }
      setLoading(false);
    };

    fetchState();
  }, [user?.id]);

  const markAsVisited = useCallback(async (pageId: string) => {
    if (!user?.id || state.visited[pageId]) return;

    const optimisticState = {
      ...state,
      visited: { ...state.visited, [pageId]: true }
    };

    setState(optimisticState);

    const { data } = await supabase
      .from('profiles')
      .select('onboarding_state')
      .eq('id', user.id)
      .single();

    const remoteState = data?.onboarding_state
      ? mergeOnboardingState(data.onboarding_state as Partial<OnboardingState>)
      : optimisticState;
    const newState = {
      ...remoteState,
      visited: { ...remoteState.visited, [pageId]: true }
    };

    setState(newState);
    await supabase.from('profiles').update({ onboarding_state: newState }).eq('id', user.id);
  }, [user?.id, state]);

  const toggleChecklistTask = useCallback(async (taskId: string, forceStatus?: boolean) => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('profiles')
      .select('onboarding_state')
      .eq('id', user.id)
      .single();

    const baseState = data?.onboarding_state
      ? mergeOnboardingState(data.onboarding_state as Partial<OnboardingState>)
      : state;
    const isCompleted = baseState.checklist.includes(taskId);
    const shouldComplete = forceStatus !== undefined ? forceStatus : !isCompleted;

    let newChecklist = [...baseState.checklist];
    if (shouldComplete && !isCompleted) {
      newChecklist.push(taskId);
    } else if (!shouldComplete && isCompleted) {
      newChecklist = newChecklist.filter(id => id !== taskId);
    }

    const newState = { ...baseState, checklist: newChecklist };
    setState(newState);
    await supabase.from('profiles').update({ onboarding_state: newState }).eq('id', user.id);
  }, [user?.id, state]);

  return { state, loading, markAsVisited, toggleChecklistTask };
}
