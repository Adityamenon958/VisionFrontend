// src/utils/trainingPersistence.ts

// Utility functions for persisting training state to localStorage



export interface FinalMetrics {

  bestEpoch?: number;

  bestLoss?: number;

  precision?: number;

  recall?: number;

  mAP50?: number;

  mAP50_95?: number;

}



export interface HyperparametersSnapshot {

  epochs?: number;

  batchSize?: number;

  imgSize?: number;

  learningRate?: number;

  workers?: number;

}



export interface ModelInfoSnapshot {

  modelId?: string;

  modelVersion?: string;

  downloadUrl?: string;

}



export interface TrainingState {

  jobId: string;

  projectId?: string;

  datasetId?: string;

  modelType?: string;

  modelSize?: string;

  status?: string;

  startedAt?: string | null;

  completedAt?: string | null;

  finalMetrics?: FinalMetrics | null;

  hyperparameters?: HyperparametersSnapshot | null;

  modelInfo?: ModelInfoSnapshot | null;

  timestamp: number;

}



const STORAGE_KEY = "visionm_active_training";



/**

 * Save training state to localStorage

 */

export const saveTrainingState = (

  jobId: string,

  metadata?: {

    projectId?: string;

    datasetId?: string;

    modelType?: string;

    modelSize?: string;

    status?: string;

    startedAt?: string | null;

    completedAt?: string | null;

    finalMetrics?: FinalMetrics | null;

    hyperparameters?: HyperparametersSnapshot | null;

    modelInfo?: ModelInfoSnapshot | null;

  }

): void => {

  try {

    const previous = loadTrainingState();



    const state: TrainingState = {

      jobId,

      projectId: metadata?.projectId ?? previous?.projectId,

      datasetId: metadata?.datasetId ?? previous?.datasetId,

      modelType: metadata?.modelType ?? previous?.modelType,

      modelSize: metadata?.modelSize ?? previous?.modelSize,

      status: metadata?.status ?? previous?.status,

      startedAt: metadata?.startedAt ?? previous?.startedAt,

      completedAt: metadata?.completedAt ?? previous?.completedAt,

      finalMetrics: metadata?.finalMetrics ?? previous?.finalMetrics ?? null,

      hyperparameters: metadata?.hyperparameters ?? previous?.hyperparameters ?? null,

      modelInfo: metadata?.modelInfo ?? previous?.modelInfo ?? null,

      timestamp: Date.now(),

    };



    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  } catch (error) {

    console.error("[trainingPersistence] Failed to save training state:", error);

  }

};



/**

 * Load training state from localStorage

 */

export const loadTrainingState = (): TrainingState | null => {

  try {

    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return null;



    const state: TrainingState = JSON.parse(stored);



    // Validate that we have at least a jobId

    if (!state.jobId) {

      clearTrainingState();

      return null;

    }



    return state;

  } catch (error) {

    console.error("[trainingPersistence] Failed to load training state:", error);

    clearTrainingState();

    return null;

  }

};



/**

 * Clear training state from localStorage

 */

export const clearTrainingState = (): void => {

  try {

    localStorage.removeItem(STORAGE_KEY);

  } catch (error) {

    console.error("[trainingPersistence] Failed to clear training state:", error);

  }

};



/**

 * Check if training state exists and is recent (within 7 days)

 */

export const hasValidTrainingState = (): boolean => {

  const state = loadTrainingState();

  if (!state) return false;



  // Consider state valid if it's less than 7 days old

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return state.timestamp > sevenDaysAgo;

};



