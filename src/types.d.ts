interface Config {
  executable: string;
  args: string[];
  volume?: number;
}

interface Event<T> {
  data?: T;
  error?: ProcessError;
}

interface EventTypes {
  error: (error: Error) => void;
  ready: (event: Event<string>) => void;
  playing: (event: Event<string>) => void;
  statusChange: (event: Event<'playing' | 'paused' | 'stopped'>) => void;
}

interface ProcessError extends Error {
  errno: number;
  syscall: string;
  code: string;
  path: string;
  spawnargs: string[];
}

interface TrackInfo {
  Artist?: string;
  Album?: string;
  Title?: string;
  File?: string;
}

interface Progress {
  time: number;
  percent: number;
  total: number;
}
