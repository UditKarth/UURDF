import { useEffect, useRef } from 'react';
import { useRobotStore } from '../store/useRobotStore';

const DEBOUNCE_MS = 50;

/**
 * When ikTarget changes, run IK after a short debounce and update ghost state.
 */
export function useIKSolver() {
  const runIK = useRobotStore((s) => s.runIK);
  const ikTarget = useRobotStore((s) => s.ikTarget);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      runIK();
      timerRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ikTarget.x, ikTarget.y, ikTarget.z, runIK]);
}
