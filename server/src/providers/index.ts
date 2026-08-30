/**
 * Provider selection — switches between mock and real AI providers.
 *
 * Provider selection is a server-side concern. The extension never
 * imports or references a concrete provider.
 */

import type { AIProvider } from './aiProvider';
import { MockAIProvider } from './mockAiProvider';

export type ProviderType = 'mock' | 'openai' | 'anthropic';

let currentProvider: AIProvider | null = null;

/**
 * Get or initialize the AI provider based on environment config.
 */
export function getProvider(type: ProviderType = 'mock'): AIProvider {
  if (currentProvider) {
    return currentProvider;
  }

  switch (type) {
    case 'mock':
      currentProvider = new MockAIProvider();
      break;
    // Future providers would be instantiated here:
    // case 'openai':
    //   currentProvider = new OpenAIProvider(process.env.OPENAI_API_KEY);
    //   break;
    // case 'anthropic':
    //   currentProvider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    //   break;
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }

  return currentProvider;
}

/**
 * Reset the provider (useful for testing).
 */
export function resetProvider(): void {
  currentProvider = null;
}
