export declare function isSupported(): boolean;
export declare function pickFile(
  extensions: string[],
): Promise<string | null>;
export declare function pickSaveLocation(
  suggestedName: string,
): Promise<string | null>;
