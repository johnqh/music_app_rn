/** One page, as base64-encoded PNG. */
export type PrintablePage = { base64: string; width: number; height: number };

export declare function isSupported(): boolean;
export declare function printPages(
  jobName: string,
  pages: PrintablePage[],
): Promise<boolean>;
