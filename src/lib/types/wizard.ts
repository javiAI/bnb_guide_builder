export interface StepFormProps {
  sessionId: string;
  initialState: Record<string, unknown>;
  maxStepReached?: number;
  snapshot?: Record<string, unknown>;
  snapshotStep?: number;
}
