/** A tiny adapter so the fishing engine can ask the fish simulation for a resident. */
export const fishBridge: {
  findNear: ((x: number, z: number, count?: number) => string[]) | null
} = {
  findNear: null,
}
