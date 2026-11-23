import type {
  AlternativeAffordabilityTier,
  AlternativeCategory,
  AlternativeEvidenceReference,
  AlternativeImpactClassification,
  AlternativeImpactDistinctionItem,
  AlternativeRelevanceScope,
  AlternativeSuitabilityStatus,
} from '@uaqa/contracts';

export const ALTERNATIVES_CACHE_TTL_MS = 5 * 60 * 1000;

export const CATEGORY_LABEL_MAP: Readonly<Record<AlternativeCategory, string>> = {
  transportation: 'Transportation',
  household_energy_heating: 'Household Energy & Heating',
  everyday_activities: 'Everyday Activities',
  consumption_waste: 'Consumption & Waste Habits',
};

export const IMPACT_LABEL_MAP: Readonly<Record<AlternativeImpactClassification, string>> = {
  local_emissions: 'Reduces local emissions',
  personal_exposure: 'Reduces personal exposure',
  both_exposure_and_emissions: 'Contributes to both exposure & emissions reduction',
  broader_sustainability: 'Broader sustainability benefit (indirect local AQ)',
};

export const AFFORDABILITY_LABEL_MAP: Readonly<Record<AlternativeAffordabilityTier, string>> = {
  zero_cost: 'No added cost / habit shift',
  low_cost: 'Low cost / accessible',
  moderate_investment: 'Moderate investment / infrastructure dependent',
};

export const RELEVANCE_LABEL_MAP: Readonly<Record<AlternativeRelevanceScope, string>> = {
  indoor: 'Indoor setting',
  outdoor: 'Outdoor setting',
  both: 'Indoor & outdoor relevance',
};

export const SUITABILITY_LABEL_MAP: Readonly<Record<AlternativeSuitabilityStatus, string>> = {
  recommended: 'Suitable for your household now',
  conditional: 'Conditional on local infrastructure & air quality',
  not_advised_now: 'Not advised outdoors right now',
};

export const IMPACT_DISTINCTION_LEGEND: readonly AlternativeImpactDistinctionItem[] = [
  {
    classification: 'local_emissions',
    label: 'Reduces local emissions',
    summary:
      'Lowers direct neighborhood exhaust, combustion smoke, or volatile organic compound (VOC) releases.',
    localPollutantRelevance:
      'Directly targets local PM2.5, NO2, CO, SO2, or VOC precursors, even when ambient neighborhood background air remains mixed.',
  },
  {
    classification: 'personal_exposure',
    label: 'Reduces personal exposure',
    summary:
      'Lowers what household members breathe during a trip or indoor task without necessarily changing total outdoor emissions.',
    localPollutantRelevance:
      'Shifts timing, route, or indoor containment relative to elevated PM2.5, NO2, or ozone conditions.',
  },
  {
    classification: 'both_exposure_and_emissions',
    label: 'Exposure & local emissions co-benefit',
    summary:
      'Reduces both household inhalation exposure and direct combustion or pollutant release.',
    localPollutantRelevance:
      'Most effective when paired with clean-air timing windows or verified non-combustion indoor methods.',
  },
  {
    classification: 'broader_sustainability',
    label: 'Broader environmental sustainability',
    summary:
      'Conserves materials, energy, or climate resources without guaranteeing immediate neighborhood air-quality improvements.',
    localPollutantRelevance:
      'Greenhouse-gas (CO2e) or landfill reductions are tracked separately from short-term PM2.5, NO2, or O3 levels.',
  },
];

export const EVIDENCE_CATALOG = {
  epaTransportation: {
    sourceName: 'US EPA — Transportation, Air Pollution, and Climate Change',
    sourceUrl:
      'https://www.epa.gov/transportation-air-pollution-and-climate-change/what-you-can-do-reduce-pollution-vehicles-and-engines',
    relevantFinding:
      'Combining errands, reducing vehicle idling, and shifting short solo passenger vehicle trips toward transit or shared rides lowers tailpipe nitrogen oxides (NOx), particulate matter, and evaporative fuel emissions.',
    versionOrDate: 'EPA Public Guidance (verified reference)',
    limitations:
      'Real-world local emission changes depend on local transit service coverage, fleet fuel mix, and cold-start trip distance; no universal percentage reduction is claimed.',
  },
  eeaUrbanMobility: {
    sourceName: 'European Environment Agency (EEA) — Transport and Air Quality',
    sourceUrl: 'https://www.eea.europa.eu/en/topics/in-depth/transport-and-mobility',
    relevantFinding:
      'Road transport remains a major contributor to urban NO2 and particulate levels; shifting urban trips to public transit or active travel reduces local exhaust, while active travelers must account for elevated street-level pollutant exposure.',
    versionOrDate: 'EEA Urban Mobility Briefing',
    limitations:
      'Walking and cycling accessibility varies by street safety, weather, and neighborhood cycling infrastructure, and higher breathing rates during exertion increase inhaled dose if ambient AQI is elevated.',
  },
  whoHouseholdEnergy: {
    sourceName: 'World Health Organization (WHO) — Household Air Pollution',
    sourceUrl:
      'https://www.who.int/news-room/fact-sheets/detail/household-air-pollution-and-health',
    relevantFinding:
      'Burning solid fuels, wet wood, or poorly vented fuels indoors generates high levels of fine particulate matter (PM2.5) and carbon monoxide; cleaner electric/district energy and proper appliance maintenance reduce indoor combustion pollution.',
    versionOrDate: 'WHO Fact Sheet (2024)',
    limitations:
      'Transitioning home heating systems depends heavily on housing tenure, local electrical/district grid infrastructure, and upfront capital affordability.',
  },
  epaBurnWise: {
    sourceName: 'US EPA — Burn Wise & Wood Smoke Guidance',
    sourceUrl: 'https://www.epa.gov/burnwise',
    relevantFinding:
      'Avoiding unnecessary open burning, trash burning, and damp wood combustion reduces fine particle smoke both indoors and in surrounding neighborhoods; annual chimney and appliance inspections reduce soot and carbon monoxide hazards.',
    versionOrDate: 'US EPA Burn Wise Guidance',
    limitations:
      'Maintenance schedules vary by fuel type and manufacturer; households renting properties may require landlord coordination for flue or furnace servicing.',
  },
  epaVocIndoor: {
    sourceName: 'US EPA — Volatile Organic Compounds & Safer Choice',
    sourceUrl:
      'https://www.epa.gov/indoor-air-quality-iaq/volatile-organic-compounds-impact-indoor-air-quality',
    relevantFinding:
      'Choosing fragrance-free, low-VOC, non-aerosol cleaning supplies and avoiding indoor smoke or aerosol sprays reduces indoor chemical concentrations during and shortly after use.',
    versionOrDate: 'US EPA IAQ Public Guidance',
    limitations:
      'Product labels vary by country; choosing low-VOC products lowers chemical exposure rather than outdoor ambient AQI.',
  },
  epaMaterialsManagement: {
    sourceName: 'US EPA — Sustainable Materials Management & Waste Reduction',
    sourceUrl: 'https://www.epa.gov/smm/sustainable-materials-management-non-hazardous-materials',
    relevantFinding:
      'Repairing goods, reducing disposable packaging, and segregating waste for formal recycling or hazardous collection lowers upstream resource extraction, landfill waste, and improper open-burning disposal risks.',
    versionOrDate: 'US EPA SMM Overview',
    limitations:
      'Upstream industrial and lifecycle greenhouse-gas benefits do not guarantee immediate reductions in neighborhood PM2.5, NO2, or ozone unless they replace local open waste burning.',
  },
} as const satisfies Record<string, AlternativeEvidenceReference>;

export const ALTERNATIVES_METHODOLOGICAL_PRINCIPLES: readonly string[] = [
  'Direct local air pollutant impacts (PM2.5, NO2, SO2, CO, O3) are strictly separated from broader sustainability or climate (greenhouse-gas) co-benefits.',
  'Qualitative comparison notes are used rather than fabricated percentage savings, cost estimates, or synthetic emission calculators.',
  'Active transport (walking/cycling) is checked dynamically against available outdoor AQI and pollutant bands so high-pollution outdoor exercise is never unconditionally advised.',
  'Infrastructure-dependent choices (public transit, carpooling, heat pumps, district heating) are explicitly flagged as conditional on neighborhood availability and housing constraints.',
];
