export type LogSink = {
  readonly lines: string[];
  log: (line: string) => void;
};

export function createLogSink(): LogSink {
  const lines: string[] = [];
  return {
    lines,
    log(line: string) {
      lines.push(line);
    },
  };
}
