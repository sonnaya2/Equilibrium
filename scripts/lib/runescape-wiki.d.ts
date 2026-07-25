/** Type declarations for scripts/lib/runescape-wiki.mjs (plain-JS helper). */
declare module "*/lib/runescape-wiki.mjs" {
  export function wikiApi(params: Record<string, string>): Promise<any>;
  export function wikiSource(
    title: string,
  ): Promise<{ title: string; revid: number; timestamp: string; content: string }>;
  export function wikiSources(
    titles: string[],
  ): Promise<Map<string, { title: string; revid: number; timestamp: string; content: string }>>;
  export function wikiPageLinks(title: string): Promise<Set<string>>;
  export function wikiRenderedText(
    title: string,
  ): Promise<{ title: string; revid: number | null; text: string }>;
}
