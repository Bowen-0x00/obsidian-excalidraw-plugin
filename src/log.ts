//ymjr: debug log helper (unreferenced in runtime)
export function log(message: string): void {
  if (process.env.NODE_ENV === 'debug') {
    console.log(message);
  }
}