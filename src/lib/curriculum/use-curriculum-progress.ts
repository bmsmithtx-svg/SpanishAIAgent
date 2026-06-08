"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { CurriculumProgress } from "@/types";
import {
  CURRICULUM_PROGRESS_CHANGED_EVENT,
  createInitialCurriculumProgress,
  loadCurriculumProgress
} from "./progress";

const SERVER_PROGRESS_SNAPSHOT = JSON.stringify(createInitialCurriculumProgress());

export function useCurriculumProgress(): CurriculumProgress {
  const snapshot = useSyncExternalStore(
    subscribeToProgress,
    getClientProgressSnapshot,
    getServerProgressSnapshot
  );

  return useMemo(() => JSON.parse(snapshot) as CurriculumProgress, [snapshot]);
}

function subscribeToProgress(onStoreChange: () => void) {
  window.addEventListener(CURRICULUM_PROGRESS_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(CURRICULUM_PROGRESS_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getClientProgressSnapshot() {
  return JSON.stringify(loadCurriculumProgress());
}

function getServerProgressSnapshot() {
  return SERVER_PROGRESS_SNAPSHOT;
}
