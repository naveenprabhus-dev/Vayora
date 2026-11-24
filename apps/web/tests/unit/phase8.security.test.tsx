import { cleanup, render, screen } from '@testing-library/react';
import type { AlternativeComparisonView } from '@uaqa/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlternativeComparisonPanel } from '../../src/features/alternatives/AlternativeComparisonPanel.tsx';

afterEach(() => {
  cleanup();
});

function buildComparison(sourceUrl: string): AlternativeComparisonView {
  return {
    alternativeId: 'transport-trip-chaining-no-idling',
    alternativeTitle: 'Combine household errands and stop idling',
    category: 'transportation',
    impactClassification: 'local_emissions',
    impactClassificationLabel: 'Reduces local emissions',
    affordabilityTier: 'zero_cost',
    affordabilityLabel: 'Zero cost',
    relevanceScope: 'outdoor',
    suitabilityStatus: 'recommended',
    selectedBaselineId: 'separate_cold_trips',
    selectedBaselineLabel: 'Separate cold trips',
    availableBaselines: [],
    currentChoiceSummary: 'Separate short drives.',
    suggestedAlternativeSummary: 'Bundle household errands into one warm-engine loop.',
    whyPreferable: 'Reduces cold-start tailpipe exhaust.',
    directAirQualityAndEmissionsEffect: 'Reduces local NO2 and PM emissions.',
    personalExposureEffect: 'Lower curb exhaust near entrances.',
    broaderSustainabilityEffect: 'Lowers overall fuel consumption.',
    ghgVsLocalPollutantDistinction: 'Distinguishes CO2 savings from local tailpipe pollutants.',
    costAndAccessibility: 'Zero monetary cost.',
    tradeoffsAndLimitations: 'Requires errand planning.',
    infrastructureConditionality: null,
    evidenceReference: {
      sourceName: 'US EPA Transportation Guidance',
      sourceUrl,
      relevantFinding: 'Bundling trips reduces cold-start exhaust.',
      versionOrDate: 'EPA',
      limitations: 'Traffic conditions vary.',
    },
  };
}

describe('Phase 8 Frontend Security Controls', () => {
  it('blocks unsafe javascript: or data: URLs in external evidence links while preserving valid https: links', () => {
    render(
      <AlternativeComparisonPanel
        comparison={buildComparison('javascript:alert(document.domain)')}
        isComparing={false}
        onSelectBaseline={vi.fn()}
      />,
    );
    expect(screen.queryByRole('link', { name: /Inspect external reference/i })).toBeNull();

    cleanup();
    render(
      <AlternativeComparisonPanel
        comparison={buildComparison('https://www.epa.gov/transportation')}
        isComparing={false}
        onSelectBaseline={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: /Inspect external reference/i });
    expect(link).toHaveAttribute('href', 'https://www.epa.gov/transportation');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
