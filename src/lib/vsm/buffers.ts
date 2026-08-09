// Matches inventory buffers (WIP) to the gap they sit in around a row of
// process boxes. For N processes there are N+1 gaps: before the first
// process (fed by the supplier), between each pair, and after the last
// process (shipped to the customer). Gap index -1 = before process[0],
// index i (0..N-2) = between process[i] and process[i+1],
// index N-1 = after process[N-1].

export function bufferGapIndices(processCount: number): number[] {
  if (processCount === 0) return []
  const indices: number[] = []
  for (let i = -1; i < processCount; i++) indices.push(i)
  return indices
}

interface BufferLike {
  from_process_id: string | null
  to_process_id: string | null
}

export function findBuffer<T extends BufferLike>(
  buffers: T[],
  fromProcessId: string | null,
  toProcessId: string | null
): T | undefined {
  return buffers.find((b) => b.from_process_id === fromProcessId && b.to_process_id === toProcessId)
}
