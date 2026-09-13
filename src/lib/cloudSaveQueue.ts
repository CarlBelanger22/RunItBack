type CloudSaveJob = {
  task: () => Promise<void>;
  urgent: boolean;
  resolve: () => void;
  reject: (err: unknown) => void;
};

const pending: CloudSaveJob[] = [];
let running = false;

function pump(): void {
  if (running) return;
  const urgentIndex = pending.findIndex((job) => job.urgent);
  const job =
    urgentIndex >= 0 ? pending.splice(urgentIndex, 1)[0] : pending.shift();
  if (!job) return;

  running = true;
  void (async () => {
    try {
      await job.task();
      running = false;
      job.resolve();
    } catch (err) {
      running = false;
      job.reject(err);
    }
    queueMicrotask(pump);
  })();
}

/** True when no cloud save is running or waiting. */
export function isCloudSaveQueueIdle(): boolean {
  return !running && pending.length === 0;
}

/** Run cloud writes one at a time. Urgent jobs jump ahead of normal ones. */
export function enqueueCloudSave(
  task: () => Promise<void>,
  options?: { urgent?: boolean }
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    pending.push({
      task,
      urgent: options?.urgent === true,
      resolve,
      reject,
    });
    pump();
  });
}

/** Test helper — drain queue bookkeeping between unit tests. */
export function __resetCloudSaveQueueForTests(): void {
  pending.length = 0;
  running = false;
}
