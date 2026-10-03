/**
 * Client helper to interact with MangaBar's GraphQL backend for extension store management.
 */

export interface ExtensionStoreInfo {
  indexUrl: string;
}

export interface ExtensionsSummary {
  totalCount: number;
  stores: ExtensionStoreInfo[];
}

export class MangaBarClient {
  public static readonly KEIYOUSHI_DEFAULT_REPO =
    'https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json';

  /**
   * Normalizes repository URLs entered by users.
   * Converts GitHub web links to the raw index.min.json endpoint required by MangaBar.
   */
  public static normalizeRepoUrl(inputUrl: string): string {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      return this.KEIYOUSHI_DEFAULT_REPO;
    }

    // Convert github.com/keiyoushi/extensions or extensions-source
    if (
      trimmed === 'https://github.com/keiyoushi/extensions' ||
      trimmed === 'https://github.com/keiyoushi/extensions/' ||
      trimmed === 'https://github.com/keiyoushi/extensions-source' ||
      trimmed === 'https://github.com/keiyoushi/extensions-source/'
    ) {
      return this.KEIYOUSHI_DEFAULT_REPO;
    }

    // Generic github.com/<user>/<repo> conversion to raw repo index.min.json if applicable
    const ghMatch = trimmed.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/);
    if (ghMatch) {
      const user = ghMatch[1];
      const repo = ghMatch[2].replace(/\.git$/, '');
      if (user.toLowerCase() === 'keiyoushi') {
        return this.KEIYOUSHI_DEFAULT_REPO;
      }
      return `https://raw.githubusercontent.com/${user}/${repo}/repo/index.min.json`;
    }

    return trimmed;
  }

  /**
   * Executes a GraphQL query/mutation against the running MangaBar server.
   */
  private static async executeGraphQL<T>(
    port: number,
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    const url = `http://127.0.0.1:${port}/api/graphql`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`GraphQL request failed with HTTP ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors.map((e) => e.message).join('; '));
    }

    return json.data as T;
  }

  /**
   * Retrieves currently registered extension stores and total extensions count.
   */
  public static async getSummary(port: number): Promise<ExtensionsSummary> {
    try {
      const query = `
        query GetExtensionsSummary {
          extensionStores {
            nodes {
              indexUrl
            }
          }
          extensions {
            totalCount
          }
        }
      `;
      const data = await this.executeGraphQL<{
        extensionStores: { nodes: ExtensionStoreInfo[] };
        extensions: { totalCount: number };
      }>(port, query);

      return {
        stores: data?.extensionStores?.nodes || [],
        totalCount: data?.extensions?.totalCount || 0,
      };
    } catch {
      return {
        stores: [],
        totalCount: 0,
      };
    }
  }

  /**
   * Adds an extension store repository and triggers an immediate extension fetch.
   */
  public static async addStore(
    port: number,
    rawUrl: string
  ): Promise<{ indexUrl: string; totalCount: number }> {
    const normalizedUrl = this.normalizeRepoUrl(rawUrl);

    const mutation = `
      mutation AddStore($input: AddExtensionStoreInput!) {
        addExtensionStore(input: $input) {
          extensionStore {
            indexUrl
          }
        }
      }
    `;

    const data = await this.executeGraphQL<{
      addExtensionStore: { extensionStore: { indexUrl: string } };
    }>(port, mutation, {
      input: {
        indexUrl: normalizedUrl,
      },
    });

    const registeredUrl = data?.addExtensionStore?.extensionStore?.indexUrl || normalizedUrl;

    // Immediately trigger fetchExtensions
    await this.fetchExtensions(port);

    // Wait a brief moment for indexing
    await new Promise((r) => setTimeout(r, 2000));

    const summary = await this.getSummary(port);

    return {
      indexUrl: registeredUrl,
      totalCount: summary.totalCount,
    };
  }

  /**
   * Triggers MangaBar to fetch/update all extension packages from configured repos.
   */
  public static async fetchExtensions(port: number): Promise<number> {
    const mutation = `
      mutation FetchAll {
        fetchExtensions(input: { clientMutationId: "mangabar-fetch" }) {
          clientMutationId
        }
      }
    `;

    try {
      await this.executeGraphQL(port, mutation);
    } catch {
      // Ignore if server is busy or already fetching
    }

    // Wait briefly and get updated count
    await new Promise((r) => setTimeout(r, 2500));
    const summary = await this.getSummary(port);
    return summary.totalCount;
  }
}

/** Compatibility alias */
export const SuwayomiClient = MangaBarClient;
