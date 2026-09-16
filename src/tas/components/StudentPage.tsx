/**
 * StudentPage
 * Mounted at /submission/:usageKey
 */

import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTasStore } from '../store/tasStore';
import { TasApp } from './TasApp';
import { buildStudentMfeContext, decodeUsageKeyParam } from '../utils/studentMfeContext';

export const StudentPage: React.FC = () => {
  const { usageKey: rawUsageKey } = useParams<{ usageKey: string }>();
  const usageKey = decodeUsageKeyParam(rawUsageKey);
  const setMfeContext = useTasStore((s) => s.setMfeContext);
  const mfeContext = useTasStore((s) => s.mfeContext);

  useEffect(() => {
    if (!usageKey) return;
    setMfeContext(buildStudentMfeContext(usageKey));
  }, [usageKey, setMfeContext]);

  if (!mfeContext || mfeContext.usageKey !== usageKey) {
    return null;
  }

  return <TasApp />;
};
