export function sleep(value: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, value));
}