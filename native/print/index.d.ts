/** A raster page for mobile or vector page for the Windows PDF bridge. */
export type PrintablePage =
  | { base64: string; width: number; height: number }
  | { svg: string; width: number; height: number };

export declare function isSupported(): boolean;
export declare function printPages(
  jobName: string,
  pages: PrintablePage[],
): Promise<boolean>;
