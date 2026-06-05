let saveQueue: Promise<void> = Promise.resolve();

/** Run cloud writes one at a time to avoid overlapping full saves. */
export function enqueueCloudSave(task: () => Promise<void>): Promise<void> {
  const run = saveQueue.then(task);
  saveQueue = run.catch(() => {});
  return run;
}
