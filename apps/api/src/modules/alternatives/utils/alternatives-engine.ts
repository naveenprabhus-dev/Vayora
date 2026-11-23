import type {
  AirQualityLocationSummary,
  AlternativeBaselineOption,
  AlternativeCategory,
  AlternativeImpactClassification,
  AlternativeSuitabilityStatus,
  AlternativesQueryInput,
  HouseholdLifestyleRecord,
  SustainableAlternativeItem,
} from '@uaqa/contracts';
import type { EvaluatedAirQualityState } from '../../routines/routines.types.ts';
import {
  AFFORDABILITY_LABEL_MAP,
  CATEGORY_LABEL_MAP,
  EVIDENCE_CATALOG,
  IMPACT_LABEL_MAP,
  RELEVANCE_LABEL_MAP,
  SUITABILITY_LABEL_MAP,
} from '../alternatives.constants.ts';

function hasSensitiveComposition(profile: HouseholdLifestyleRecord): boolean {
  return (
    profile.householdComposition.includes('young_children') ||
    profile.householdComposition.includes('older_adults')
  );
}

function isCombustionVehicleCommute(mode: HouseholdLifestyleRecord['primaryCommuteMode']): boolean {
  return mode === 'gas_vehicle' || mode === 'carpool';
}

function buildBaseline(
  id: string,
  label: string,
  summary: string,
  exposureRiskNote: string,
  emissionProfileNote: string,
  sustainabilityNote: string,
): AlternativeBaselineOption {
  return {
    id,
    label,
    summary,
    exposureRiskNote,
    emissionProfileNote,
    sustainabilityNote,
  };
}

function formatSuitability(
  status: AlternativeSuitabilityStatus,
  reason: string,
): {
  readonly suitabilityStatus: AlternativeSuitabilityStatus;
  readonly suitabilityLabel: string;
  readonly suitabilityReason: string;
} {
  return {
    suitabilityStatus: status,
    suitabilityLabel: SUITABILITY_LABEL_MAP[status],
    suitabilityReason: reason,
  };
}

export function generateSustainableAlternativesCatalog(options: {
  readonly profile: HouseholdLifestyleRecord;
  readonly aqState: EvaluatedAirQualityState;
  readonly location: AirQualityLocationSummary;
}): readonly SustainableAlternativeItem[] {
  const { profile, aqState, location } = options;
  const sensitiveGroupPresent = hasSensitiveComposition(profile);
  const commute = profile.primaryCommuteMode;
  const heating = profile.heatingType;
  const cityLabel = `${location.city}, ${location.country}`;

  const items: SustainableAlternativeItem[] = [];

  // 1. TRANSPORTATION: Public transit instead of individual vehicle trips
  if (commute !== 'public_transit') {
    const isDriver = commute === 'gas_vehicle' || commute === 'ev' || commute === 'carpool';
    const transitSuitability = formatSuitability(
      'conditional',
      `Tailored for ${cityLabel}: local transit route coverage, frequency, and walking segments to stops are not verified automatically by VAYORA.`,
    );
    items.push({
      id: 'transport-public-transit',
      category: 'transportation',
      categoryLabel: CATEGORY_LABEL_MAP.transportation,
      title: 'Shift suitable urban trips to public transportation',
      currentHabitMatched: isDriver
        ? `Saved commute: ${commute.replaceAll('_', ' ')}`
        : `Saved commute: ${commute.replaceAll('_', ' ')} (weather/AQI backup)`,
      impactClassification:
        aqState.isHighOrWorse && (commute === 'walking' || commute === 'cycling')
          ? 'personal_exposure'
          : 'local_emissions',
      impactClassificationLabel:
        IMPACT_LABEL_MAP[
          aqState.isHighOrWorse && (commute === 'walking' || commute === 'cycling')
            ? 'personal_exposure'
            : 'local_emissions'
        ],
      affordabilityTier: 'low_cost',
      affordabilityLabel: AFFORDABILITY_LABEL_MAP.low_cost,
      relevanceScope: 'outdoor',
      relevanceLabel: RELEVANCE_LABEL_MAP.outdoor,
      ...transitSuitability,
      personalizationDrivers: [
        `Primary commute (${commute.replaceAll('_', ' ')})`,
        `Zone context (${profile.locationPreferences.primaryZoneType.replaceAll('_', ' ')})`,
        ...(aqState.isElevatedOrWorse ? [`Current outdoor status (${aqState.usAqiSnippet})`] : []),
      ],
      currentChoice: isDriver
        ? 'Taking individual passenger vehicle trips along congested neighborhood roads.'
        : 'Relying solely on exposed street-side travel regardless of rain, distance, or pollution spikes.',
      suggestedAlternative:
        'Use existing bus, tram, metro, or rail corridors for routine commutes and central errands where stops are accessible.',
      whyPreferable:
        'Consolidating dozens of separate passenger trips onto shared transit reduces per-person street-level exhaust emissions and cold-start fuel combustion in urban centers.',
      directAqVsBroaderNote:
        'Primarily reduces local vehicle emissions (NO2, tailpipe PM2.5, CO) when replacing combustion car trips; during elevated outdoor pollution, enclosed transit can also reduce exertion-driven pollutant intake compared to strenuous roadside cycling.',
      ghgVsLocalPollutantNote:
        'Tailpipe NO2 and fine particulate reductions act directly in street corridors, separate from regional fuel-lifecycle greenhouse-gas savings.',
      tradeoffsAndLimitations:
        'Transit service frequency, last-mile walking exposure along busy roads, crowded vehicles, and fare affordability vary significantly by neighborhood.',
      costAndAccessibilityNote:
        'Low ongoing per-trip cost where passes or subsidized transit exist, though service gaps in outer suburbs may limit practicality.',
      infrastructureConditionality: `Conditional on verified transit lines, schedules, and safe stop access in ${location.neighborhood}, ${location.city}.`,
      qualitativeComparisonNote:
        'Qualitatively lowers per-passenger tailpipe exhaust versus solo combustion driving without relying on unverified mileage or percentage calculators.',
      baselineOptions: [
        buildBaseline(
          'solo_gas_vehicle',
          'Solo gasoline/diesel car',
          'Driving an internal combustion vehicle alone for single-occupant urban trips.',
          'In-cabin pollution rises sharply in stop-and-go queues unless cabin recirculation is engaged.',
          'Highest per-passenger street-level NO2, tailpipe PM2.5, and evaporative VOC exhaust per kilometer.',
          'Highest fuel and parking resource intensity per traveler.',
        ),
        buildBaseline(
          'solo_ev',
          'Solo electric vehicle',
          'Driving a battery electric passenger car alone.',
          'Lower tailpipe emissions, though non-exhaust brake/tire dust and road-queue air remain present.',
          'Zero tailpipe exhaust locally; brake and tire wear particulates persist alongside grid charging profile.',
          'Requires personal vehicle space and battery lifecycle footprint compared to shared transit.',
        ),
        buildBaseline(
          'exposed_roadside_active',
          'Exposed roadside active travel during high AQI',
          'Walking or cycling directly beside heavy traffic during pollution episodes.',
          'Higher breathing rate increases fine-particle and NO2 dose along congested avenues.',
          'Zero tailpipe emissions.',
          'Minimal material footprint, but health suitability drops when AQI is elevated.',
        ),
      ],
      defaultBaselineId: commute === 'ev' ? 'solo_ev' : 'solo_gas_vehicle',
      evidenceReference: EVIDENCE_CATALOG.epaTransportation,
    });
  }

  // 2. TRANSPORTATION: Combine errands & reduce unnecessary idling (essential for drivers, helpful generally)
  if (isCombustionVehicleCommute(commute) || commute === 'ev') {
    const isFuelDriver = isCombustionVehicleCommute(commute);
    items.push({
      id: 'transport-trip-chaining-no-idling',
      category: 'transportation',
      categoryLabel: CATEGORY_LABEL_MAP.transportation,
      title: 'Combine household errands and eliminate unnecessary vehicle idling',
      currentHabitMatched: `Saved commute (${commute.replaceAll('_', ' ')}) · Household size ${profile.householdSize}`,
      impactClassification: isFuelDriver ? 'local_emissions' : 'broader_sustainability',
      impactClassificationLabel:
        IMPACT_LABEL_MAP[isFuelDriver ? 'local_emissions' : 'broader_sustainability'],
      affordabilityTier: 'zero_cost',
      affordabilityLabel: AFFORDABILITY_LABEL_MAP.zero_cost,
      relevanceScope: 'outdoor',
      relevanceLabel: RELEVANCE_LABEL_MAP.outdoor,
      ...formatSuitability(
        'recommended',
        'Immediate zero-cost habit shift under your household’s direct control without needing new infrastructure.',
      ),
      personalizationDrivers: [
        `Commute mode (${commute.replaceAll('_', ' ')})`,
        `Household size (${profile.householdSize} members)`,
        ...(sensitiveGroupPresent ? ['Child/older-adult pickup & driveway air sensitivity'] : []),
      ],
      currentChoice:
        'Making multiple separated cold-start car trips across the week and leaving the engine running while waiting at schools, shops, or driveways.',
      suggestedAlternative:
        'Group errands into one planned loop and turn off the ignition whenever stationary outside active traffic lanes.',
      whyPreferable:
        'Cold-start catalytic converters operate less efficiently during the first minutes of driving, and stationary idling concentrates exhaust directly near sidewalks, schools, and home windows.',
      directAqVsBroaderNote: isFuelDriver
        ? 'Directly cuts local tailpipe emissions (NO2, CO, unburned hydrocarbons, particulate soot) near driveways and school pick-up zones.'
        : 'For electric vehicles, local tailpipe exhaust is already zero; chaining trips still reduces tire/brake particle wear, congestion, and broader grid energy demand.',
      ghgVsLocalPollutantNote:
        'Stopping idling cuts immediate toxic exhaust near bystanders (CO, NO2, PM2.5) separately from fuel/CO2 conservation.',
      tradeoffsAndLimitations:
        'Requires advance weekly planning and may not be practical for urgent caregiving, temperature-critical errands, or extreme cold starts where brief defogging is needed for road safety.',
      costAndAccessibilityNote:
        'Zero cost and saves fuel/battery charge immediately without purchasing any equipment.',
      infrastructureConditionality: null,
      qualitativeComparisonNote:
        'Qualitatively reduces cold-start exhaust bursts and stationary curb fumes versus ungrouped trips.',
      baselineOptions: [
        buildBaseline(
          'separate_cold_trips',
          'Separate cold-start trips & idling',
          'Running separate short trips daily and idling while parked or waiting.',
          'Concentrates exhaust around parked vehicles, entrances, and waiting passengers.',
          'Higher cold-start NOx, CO, and hydrocarbon emissions plus continuous stationary exhaust.',
          'Higher fuel and tire wear consumption.',
        ),
        buildBaseline(
          'delivery_split_orders',
          'Frequent unbundled small deliveries',
          'Replacing personal trips with many separate on-demand vehicle dispatches.',
          'Lowers driver time, though curb delivery stops add local traffic micro-emissions.',
          'Shifts exhaust from private vehicle to commercial van cycles.',
          'Higher packaging and cumulative courier kilometers when unbundled.',
        ),
      ],
      defaultBaselineId: 'separate_cold_trips',
      evidenceReference: EVIDENCE_CATALOG.epaTransportation,
    });
  }

  // 3. TRANSPORTATION: Carpooling / shared transport where practical
  if (commute === 'gas_vehicle' || commute === 'ev') {
    items.push({
      id: 'transport-shared-carpool',
      category: 'transportation',
      categoryLabel: CATEGORY_LABEL_MAP.transportation,
      title: 'Coordinate shared carpooling for regular commutes or school runs',
      currentHabitMatched: `Saved commute (${commute.replaceAll('_', ' ')}) · Activity (${profile.outdoorActivityPattern.replaceAll('_', ' ')})`,
      impactClassification: 'local_emissions',
      impactClassificationLabel: IMPACT_LABEL_MAP.local_emissions,
      affordabilityTier: 'zero_cost',
      affordabilityLabel: AFFORDABILITY_LABEL_MAP.zero_cost,
      relevanceScope: 'outdoor',
      relevanceLabel: RELEVANCE_LABEL_MAP.outdoor,
      ...formatSuitability(
        'conditional',
        `Requires matching schedules with coworkers, neighbors, or school families in ${location.neighborhood}.`,
      ),
      personalizationDrivers: [
        `Individual driving baseline (${commute.replaceAll('_', ' ')})`,
        `Outdoor activity pattern (${profile.outdoorActivityPattern.replaceAll('_', ' ')})`,
      ],
      currentChoice:
        'Each household driving an individual car along identical morning/evening corridors.',
      suggestedAlternative:
        'Alternate driving duties with one or more households sharing the same workplace, transit hub, or school drop-off route.',
      whyPreferable:
        'Halving or reducing parallel vehicle trips removes full exhaust plumes, brake/tire particulate shedding, and congestion queues from shared neighborhood corridors.',
      directAqVsBroaderNote:
        'Directly lowers local vehicle emissions (tailpipe gases + non-exhaust tire/brake road dust) on congested school and commuter streets.',
      ghgVsLocalPollutantNote:
        'Street-corridor congestion and curb exhaust drop alongside reduced total fuel or electricity demand.',
      tradeoffsAndLimitations:
        'Schedule rigidity, childcare car-seat transfers, and unexpected overtime make carpooling impractical on days requiring flexible return times.',
      costAndAccessibilityNote:
        'Zero cost (often lowers household fuel/parking costs via rotation), conditional on trusted local social/school coordination.',
      infrastructureConditionality:
        'Depends on compatible commuter schedules, neighborhood pickup proximity, and child-safety seat logistics where applicable.',
      qualitativeComparisonNote:
        'Qualitatively lowers per-household vehicle kilometers and corridor exhaust compared to parallel solo driving.',
      baselineOptions: [
        buildBaseline(
          'parallel_solo_driving',
          'Parallel single-household driving',
          'Each nearby family or coworker drives separately at the same peak hour.',
          'More queuing vehicles around school gates and intersections increases curb exposure.',
          'Duplicates full vehicle exhaust and brake/tire particulate emissions.',
          'Duplicates vehicle wear, fuel, and parking pressure.',
        ),
      ],
      defaultBaselineId: 'parallel_solo_driving',
      evidenceReference: EVIDENCE_CATALOG.eeaUrbanMobility,
    });
  }

  // 4. TRANSPORTATION: Walking or cycling WHEN air quality and safety permit (AQI-SENSITIVE!)
  const activeTransportSuitability = aqState.isUnavailable
    ? formatSuitability(
        'conditional',
        `Live outdoor AQI telemetry is unavailable in ${location.city}; verify visible local haze and low-traffic side streets before extended outdoor exertion.`,
      )
    : aqState.isHighOrWorse
      ? formatSuitability(
          'not_advised_now',
          `Not advised as an immediate outdoor swap right now: current ${aqState.usAqiSnippet} (${aqState.dominantLabel}) increases inhaled pollutant dose during brisk walking or cycling.`,
        )
      : aqState.isElevatedOrWorse
        ? formatSuitability(
            'conditional',
            `Conditional right now (${aqState.usAqiSnippet}): moderate/elevated pollution means active travel is best kept brief on quiet side streets${sensitiveGroupPresent ? ', especially with young children or older adults' : ''}.`,
          )
        : formatSuitability(
            'recommended',
            `Current outdoor conditions (${aqState.usAqiSnippet}) permit short-distance walking or cycling along lower-traffic routes when street safety allows.`,
          );

  items.push({
    id: 'transport-active-travel-aqi-aware',
    category: 'transportation',
    categoryLabel: CATEGORY_LABEL_MAP.transportation,
    title: 'Walk or cycle short errands only when air quality and street safety permit',
    currentHabitMatched:
      commute === 'walking' || commute === 'cycling'
        ? 'Already an active traveler — AQI route & timing safeguard'
        : `Short motorized trips (${commute.replaceAll('_', ' ')})`,
    impactClassification:
      aqState.isElevatedOrWorse || aqState.isUnavailable
        ? 'personal_exposure'
        : 'both_exposure_and_emissions',
    impactClassificationLabel:
      IMPACT_LABEL_MAP[
        aqState.isElevatedOrWorse || aqState.isUnavailable
          ? 'personal_exposure'
          : 'both_exposure_and_emissions'
      ],
    affordabilityTier: 'zero_cost',
    affordabilityLabel: AFFORDABILITY_LABEL_MAP.zero_cost,
    relevanceScope: 'outdoor',
    relevanceLabel: RELEVANCE_LABEL_MAP.outdoor,
    ...activeTransportSuitability,
    personalizationDrivers: [
      `Live outdoor status (${aqState.usAqiSnippet})`,
      `Commute profile (${commute.replaceAll('_', ' ')})`,
      ...(sensitiveGroupPresent ? ['Household includes sensitive life-stage members'] : []),
    ],
    currentChoice:
      commute === 'walking' || commute === 'cycling'
        ? 'Walking or cycling along busy arterial roads even when PM2.5, NO2, or ozone spikes occur.'
        : 'Driving short neighborhood errands under 1–2 km even on clean-air days with safe sidewalks.',
    suggestedAlternative: aqState.isHighOrWorse
      ? 'Pause optional strenuous outdoor cycling/walking during elevated pollution; use enclosed lower-exertion transit or defer non-urgent errands to cleaner forecast windows.'
      : 'Choose quiet, tree-lined side streets away from tailpipe lanes for walking or cycling during cleaner air-quality windows.',
    whyPreferable:
      'Active travel produces zero tailpipe emissions, yet higher breathing rates increase pollutant inhalation during smog episodes—so matching active travel to cleaner AQI windows protects health while avoiding short cold-start car trips.',
    directAqVsBroaderNote:
      'Clean-air active travel removes local vehicle exhaust (both_exposure_and_emissions when low-AQI & replacing a car), whereas postponing active travel on high-AQI days strictly protects personal respiratory exposure rather than lowering neighborhood emissions.',
    ghgVsLocalPollutantNote:
      'Zero tailpipe CO2 and zero local NO2/PM2.5 emission, balanced explicitly against personal inhaled dose during poor ambient air quality.',
    tradeoffsAndLimitations:
      'Never universally healthier during smog, wildfire smoke, heatwaves, icy pavements, or routes lacking protected bike lanes/crosswalks.',
    costAndAccessibilityNote:
      'Walking is zero cost; cycling requires safe bicycle storage, weather gear, and protected street infrastructure.',
    infrastructureConditionality: `Sidewalk continuity, lighting, and separated cycling lanes in ${location.neighborhood}, ${location.city} are not verified automatically.`,
    qualitativeComparisonNote:
      'Balances local emission avoidance against personal inhalation dose using live Phase 2/3 air-quality conditions without fabricating health risk ratios.',
    baselineOptions: [
      buildBaseline(
        'short_solo_car_errand',
        'Short solo car trip (clean-air day)',
        'Driving 1–2 km for a single light errand when air quality is good.',
        'Moderate in-cabin exposure near intersections.',
        'Disproportionately high cold-start tailpipe exhaust for distance covered.',
        'Avoidable fuel/battery and parking footprint.',
      ),
      buildBaseline(
        'arterial_cycling_high_aqi',
        'High-exertion arterial cycling during poor AQI',
        'Cycling beside idling traffic when PM2.5, NO2, or ozone is elevated.',
        'Elevated respiratory minute volume draws higher concentrations of fine particles and gases.',
        'Zero tailpipe emission.',
        'Low material footprint, but health trade-off outweighs benefit during pollution spikes.',
      ),
    ],
    defaultBaselineId:
      commute === 'walking' || commute === 'cycling'
        ? 'arterial_cycling_high_aqi'
        : 'short_solo_car_errand',
    evidenceReference: EVIDENCE_CATALOG.eeaUrbanMobility,
  });

  // 5. HOUSEHOLD ENERGY & HEATING: Combustion avoidance OR Maintenance OR Clean Heating Path
  if (heating === 'solid_fuel') {
    items.push({
      id: 'heating-solid-fuel-cleaner-shift',
      category: 'household_energy_heating',
      categoryLabel: CATEGORY_LABEL_MAP.household_energy_heating,
      title: 'Transition away from indoor solid-fuel burning where feasible & enforce safe venting',
      currentHabitMatched: 'Saved heating: Solid fuel (wood/coal)',
      impactClassification: 'both_exposure_and_emissions',
      impactClassificationLabel: IMPACT_LABEL_MAP.both_exposure_and_emissions,
      affordabilityTier: 'moderate_investment',
      affordabilityLabel: AFFORDABILITY_LABEL_MAP.moderate_investment,
      relevanceScope: 'both',
      relevanceLabel: RELEVANCE_LABEL_MAP.both,
      ...formatSuitability(
        'conditional',
        'Fuel-switching depends heavily on homeownership, utility connections, and municipal clean-heat subsidies; safe dry-fuel & venting steps apply immediately.',
      ),
      personalizationDrivers: [
        'Primary heating setup (solid fuel)',
        ...(sensitiveGroupPresent ? ['Household sensitive groups present indoors'] : []),
        ...(profile.locationPreferences.primaryZoneType === 'valley_basin'
          ? ['Valley/basin winter smoke trapping risk']
          : []),
      ],
      currentChoice:
        'Heating regularly with solid fuel (wood, coal, or briquettes), which releases fine smoke particles indoors during loading/drafts and outdoors through chimneys.',
      suggestedAlternative:
        'Where building ownership and local energy infrastructure allow, evaluate cleaner non-combustion heating (heat pump or district heat) with local rebate support; in the meantime, burn only dry seasoned fuel with annual chimney cleaning and keep working CO/smoke alarms.',
      whyPreferable:
        'Domestic solid-fuel combustion is a leading driver of residential PM2.5, black carbon, and carbon monoxide both inside the home and across neighboring yards—especially in valley basins.',
      directAqVsBroaderNote:
        'Directly lowers both indoor smoke exposure and neighborhood winter PM2.5/CO emissions.',
      ghgVsLocalPollutantNote:
        'Even where wood is marketed as renewable carbon, local fine-particle (PM2.5) and PAH air pollution remains severe compared to electric heat pumps or filtered district systems.',
      tradeoffsAndLimitations:
        'Upfront equipment costs, electrical panel capacity, rental restrictions, and local grid electricity reliability can prevent immediate heating replacement.',
      costAndAccessibilityNote:
        'Appliance replacement involves moderate-to-high capital cost and requires landlord or subsidy support; checking flue seals and burning dry wood only is low/zero added cost.',
      infrastructureConditionality: `Feasibility depends on district heating pipes, electric grid capacity, building insulation, and local clean-air grants in ${cityLabel}.`,
      qualitativeComparisonNote:
        'Qualitatively compares residential solid-fuel smoke plumes with non-combustion heat delivery; never pressures households to buy equipment they cannot access.',
      baselineOptions: [
        buildBaseline(
          'unmaintained_solid_fuel',
          'Routine solid-fuel combustion (wet/unseasoned fuel)',
          'Frequent burning of damp wood or mixed fuels in older or unserviced stoves.',
          'Highest indoor PM2.5 leakage, soot, and carbon monoxide (CO) hazard.',
          'Heavy neighborhood woodsmoke PM2.5, PAHs, and CO plume.',
          'Inefficient thermal recovery per unit of fuel.',
        ),
        buildBaseline(
          'natural_gas_boiler',
          'Modern vented gas boiler',
          'Using a sealed, annually inspected natural gas boiler instead of solid fuel.',
          'Significantly lower indoor particle smoke than solid fuel when properly vented, though NO2/CO safety checks remain essential.',
          'Substantially lower PM2.5 smoke than solid fuel, though fossil NOx emissions remain.',
          'Still relies on fossil methane distribution.',
        ),
      ],
      defaultBaselineId: 'unmaintained_solid_fuel',
      evidenceReference: EVIDENCE_CATALOG.whoHouseholdEnergy,
    });
  } else {
    items.push({
      id: 'heating-energy-maintenance-efficiency',
      category: 'household_energy_heating',
      categoryLabel: CATEGORY_LABEL_MAP.household_energy_heating,
      title: 'Maintain existing heating equipment & seal thermal drafts before raising heat',
      currentHabitMatched: `Saved heating (${heating.replaceAll('_', ' ')}) · Ventilation (${profile.ventilationContext.replaceAll('_', ' ')})`,
      impactClassification:
        heating === 'natural_gas' ? 'local_emissions' : 'broader_sustainability',
      impactClassificationLabel:
        IMPACT_LABEL_MAP[heating === 'natural_gas' ? 'local_emissions' : 'broader_sustainability'],
      affordabilityTier: 'low_cost',
      affordabilityLabel: AFFORDABILITY_LABEL_MAP.low_cost,
      relevanceScope: 'indoor',
      relevanceLabel: RELEVANCE_LABEL_MAP.indoor,
      ...formatSuitability(
        'recommended',
        'Practical maintenance and simple draft/thermostat tuning work with your current heating system without unnecessary appliance purchases.',
      ),
      personalizationDrivers: [
        `Current heating (${heating.replaceAll('_', ' ')})`,
        `Ventilation setup (${profile.ventilationContext.replaceAll('_', ' ')})`,
      ],
      currentChoice:
        'Running heating at steady peak settings with dusty filters/radiators, unsealed door gaps, or deferred burner maintenance.',
      suggestedAlternative:
        'Keep filters and radiator/convection surfaces clean, seal unintended cold window/door drafts (without blocking required combustion air vents or safety ventilation), and apply modest setback temperatures overnight.',
      whyPreferable:
        'Clean filters and balanced heat retention reduce runtime demand and prevent soot/CO malfunction in fuel-burning appliances without pushing new hardware purchases.',
      directAqVsBroaderNote:
        heating === 'natural_gas'
          ? 'Cleaner gas burner maintenance lowers local boiler NOx emissions and indoor CO malfunction risk alongside lower gas consumption.'
          : 'For electric, heat-pump, or district systems, reducing kilowatt demand delivers broader energy and climate sustainability benefits without directly altering local ambient air quality.',
      ghgVsLocalPollutantNote:
        'Explicitly distinguishes indirect power-plant or climate CO2e savings (broader sustainability) from direct home-chimney combustion emissions.',
      tradeoffsAndLimitations:
        'Draft sealing must NEVER block safety vents near gas appliances or fireplaces, and indoor thermal comfort for young children or older adults must take priority over aggressive setbacks.',
      costAndAccessibilityNote:
        'Low cost (weatherstripping, filter checks, thermostat schedules); landlord coordination may apply for boiler servicing in rentals.',
      infrastructureConditionality: null,
      qualitativeComparisonNote:
        'Qualitatively compares well-maintained, lower-loss operation against unserviced baseline use without inventing utility bill dollar or percentage claims.',
      baselineOptions: [
        buildBaseline(
          'unmaintained_drafty_heating',
          'Unserviced heating & unsealed drafts',
          'Heating a drafty home continuously without filter or flue maintenance.',
          'Higher risk of clogged airflow or unsafe combustion venting on fuel-burning units.',
          'Higher fuel burn and boiler NOx emissions (for combustion heating).',
          'Higher electricity/heat energy consumption overall.',
        ),
      ],
      defaultBaselineId: 'unmaintained_drafty_heating',
      evidenceReference: EVIDENCE_CATALOG.whoHouseholdEnergy,
    });
  }

  // 6. EVERYDAY ACTIVITIES: Avoid unnecessary smoke, recreational burning & open combustion
  items.push({
    id: 'everyday-avoid-smoke-combustion',
    category: 'everyday_activities',
    categoryLabel: CATEGORY_LABEL_MAP.everyday_activities,
    title:
      'Replace smoke-producing habits (incense, backyard fires, candles) with smoke-free routines',
    currentHabitMatched: `Household (${profile.householdSize} members) · ${profile.ventilationContext.replaceAll('_', ' ')}`,
    impactClassification: 'both_exposure_and_emissions',
    impactClassificationLabel: IMPACT_LABEL_MAP.both_exposure_and_emissions,
    affordabilityTier: 'zero_cost',
    affordabilityLabel: AFFORDABILITY_LABEL_MAP.zero_cost,
    relevanceScope: 'both',
    relevanceLabel: RELEVANCE_LABEL_MAP.both,
    ...formatSuitability(
      'recommended',
      'Zero-cost indoor and yard habit shift that immediately prevents unnecessary fine-particle smoke.',
    ),
    personalizationDrivers: [
      `Indoor ventilation (${profile.ventilationContext.replaceAll('_', ' ')})`,
      ...(sensitiveGroupPresent
        ? ['Young children or older adults especially sensitive to indoor smoke']
        : []),
      ...(aqState.isElevatedOrWorse
        ? ['Elevated outdoor AQI makes indoor air dilution harder']
        : []),
    ],
    currentChoice:
      'Lighting scented candles/incense indoors, using charcoal/wood backyard fire pits during stagnant weather, or burning garden trimmings.',
    suggestedAlternative:
      'Switch to battery/LED ambient lighting, electric grilling or smoke-free food preparation, and municipal green-waste composting instead of burning brush.',
    whyPreferable:
      'Even brief indoor incense/candle smoke or outdoor yard fires release concentrated fine particulates (PM2.5), carbon monoxide, and irritating aldehydes right where family members breathe.',
    directAqVsBroaderNote:
      'Directly reduces both personal inhalation exposure and immediate residential combustion emissions (PM2.5, CO, black carbon).',
    ghgVsLocalPollutantNote:
      'Primary gain is immediate neighborhood and indoor PM2.5 particle avoidance rather than global greenhouse accounting.',
    tradeoffsAndLimitations:
      'Cultural, religious, or social traditions involving candles or cooking smoke may call for targeted exhaust ventilation or outdoor wind-aware placement rather than abrupt elimination.',
    costAndAccessibilityNote:
      'Zero cost to skip recreational burning/incense; composting relies on yard space or municipal green bins.',
    infrastructureConditionality:
      'Green-waste collection pickup varies by municipality when replacing yard burning.',
    qualitativeComparisonNote:
      'Eliminates point-source fine-particle smoke plumes compared to routine indoor/backyard burning.',
    baselineOptions: [
      buildBaseline(
        'indoor_candles_incense',
        'Routine indoor candles or incense',
        'Burning paraffin candles or incense inside living spaces with limited airing.',
        'Spikes localized indoor PM2.5 and ultrafine soot particles near occupants.',
        'Direct indoor combustion particulate and VOC release.',
        'Consumable wax and fragrance packaging waste.',
      ),
      buildBaseline(
        'backyard_brush_fire',
        'Backyard garden waste or fire-pit burning',
        'Burning leaves, brush, or firewood outdoors in residential neighborhoods.',
        'Smoke drifts directly into nearby yards and open household windows.',
        'High local PM2.5, CO, and polycyclic aromatic hydrocarbon emissions.',
        'Wastes organic nutrients that could return to soil via composting.',
      ),
    ],
    defaultBaselineId: 'indoor_candles_incense',
    evidenceReference: EVIDENCE_CATALOG.epaBurnWise,
  });

  // 7. EVERYDAY ACTIVITIES: Low-VOC, non-aerosol cleaning & household products
  items.push({
    id: 'everyday-low-voc-cleaning',
    category: 'everyday_activities',
    categoryLabel: CATEGORY_LABEL_MAP.everyday_activities,
    title: 'Use fragrance-free, low-VOC, non-aerosol cleaning methods indoors',
    currentHabitMatched: `Indoor environment · ${profile.hasIndoorAirPurifier ? 'HEPA purifier present (particles only)' : 'No HEPA purifier'}`,
    impactClassification: 'personal_exposure',
    impactClassificationLabel: IMPACT_LABEL_MAP.personal_exposure,
    affordabilityTier: 'low_cost',
    affordabilityLabel: AFFORDABILITY_LABEL_MAP.low_cost,
    relevanceScope: 'indoor',
    relevanceLabel: RELEVANCE_LABEL_MAP.indoor,
    ...formatSuitability(
      'recommended',
      'Low-cost product swap that lowers indoor gaseous VOC exposure directly—especially important because standard HEPA filters do not capture gases.',
    ),
    personalizationDrivers: [
      `Purifier profile (${profile.hasIndoorAirPurifier ? 'HEPA removes particles, not cleaning VOC gases' : 'no purifier'})`,
      `Ventilation (${profile.ventilationContext.replaceAll('_', ' ')})`,
    ],
    currentChoice:
      'Using pressurized aerosol sprays, strongly fragranced disinfectants, or high-VOC solvents during routine household cleaning.',
    suggestedAlternative:
      'Choose fragrance-free, low-VOC liquid or trigger-free wipe/damp-microfiber methods with plain soap and water for daily surfaces, reserving strong disinfectants only for targeted hygiene.',
    whyPreferable:
      'Aerosols suspend breathable droplets in room air, and high-VOC fragrances/solvents react indoors and linger even when windows stay shut due to high outdoor smog.',
    directAqVsBroaderNote:
      'Primarily reduces personal indoor chemical exposure (personal_exposure); does not meaningfully alter outdoor neighborhood AQI.',
    ghgVsLocalPollutantNote:
      'Avoids propellant gases and indoor volatile organics; clearly distinct from outdoor PM2.5 or climate metrics.',
    tradeoffsAndLimitations:
      'Concentrated or certified low-VOC cleaners may cost slightly more upfront or be less stocked in small neighborhood shops; heavy grease or medical sanitation still requires appropriate approved agents used with ventilation.',
    costAndAccessibilityNote:
      'Low cost—plain mild dish soap, diluted vinegar (never mixed with bleach!), and damp microfiber cloths often cost less than specialty aerosol sprays.',
    infrastructureConditionality: null,
    qualitativeComparisonNote:
      'Qualitatively lowers airborne aerosol droplets and indoor VOC odor load relative to fragranced aerosol sprays.',
    baselineOptions: [
      buildBaseline(
        'fragranced_aerosols',
        'Fragranced aerosol sprays & strong solvents',
        'Routine spraying of pressurized air fresheners and fragranced solvent cleaners.',
        'Directly releases inhalable droplets and VOC gases into breathing zones.',
        'Minor outdoor VOC contribution; dominant concern is indoor chemical concentration.',
        'Pressurized metal canisters increase packaging waste.',
      ),
    ],
    defaultBaselineId: 'fragranced_aerosols',
    evidenceReference: EVIDENCE_CATALOG.epaVocIndoor,
  });

  // 8. CONSUMPTION & WASTE HABITS: Repair, reuse & packaging reduction (Broader Sustainability!)
  items.push({
    id: 'consumption-reuse-repair-packaging',
    category: 'consumption_waste',
    categoryLabel: CATEGORY_LABEL_MAP.consumption_waste,
    title: 'Prioritize repair, durable reuse, and lower-packaging everyday purchases',
    currentHabitMatched: `Household (${profile.householdSize} members) · Everyday goods & food packaging`,
    impactClassification: 'broader_sustainability',
    impactClassificationLabel: IMPACT_LABEL_MAP.broader_sustainability,
    affordabilityTier: 'zero_cost',
    affordabilityLabel: AFFORDABILITY_LABEL_MAP.zero_cost,
    relevanceScope: 'both',
    relevanceLabel: RELEVANCE_LABEL_MAP.both,
    ...formatSuitability(
      'recommended',
      'Accessible long-term sustainability habit—explicitly labeled as broader sustainability rather than a direct short-term AQI fix.',
    ),
    personalizationDrivers: [
      `Household size (${profile.householdSize} members)`,
      `Guidance preference (${profile.lifestylePreferences.preferredGuidanceFocus.replaceAll('_', ' ')})`,
    ],
    currentChoice:
      'Replacing repairable appliances/textiles prematurely and buying single-use packaged items for routine household consumption.',
    suggestedAlternative:
      'Maintain and repair durable household goods first, buy concentrated refills or bulk staples where practical, and bring reusable bags/containers.',
    whyPreferable:
      'Extends product lifespan and cuts upstream manufacturing energy, raw material extraction, and municipal landfill waste burden.',
    directAqVsBroaderNote:
      'Broader environmental sustainability benefit: lowers lifecycle resource use and upstream industrial emissions, but does NOT immediately lower current neighborhood PM2.5, NO2, or ozone concentrations.',
    ghgVsLocalPollutantNote:
      'Explicitly separates upstream lifecycle greenhouse-gas (CO2e) and landfill reductions from direct neighborhood air pollution—VAYORA never claims buying reusable goods fixes today’s outdoor smog.',
    tradeoffsAndLimitations:
      'Repair parts can be unavailable or pricey for sealed electronics, and bulk/refill options take storage space or upfront grocery budget.',
    costAndAccessibilityNote:
      'Zero to low cost—reusing containers and delaying replacement typically saves household money over time.',
    infrastructureConditionality:
      'Refill stations, local repair cafes, and warranty spare-parts availability vary by city.',
    qualitativeComparisonNote:
      'Qualitatively lowers household waste generation and upstream manufacturing demand without fabricating CO2e kilograms or currency savings.',
    baselineOptions: [
      buildBaseline(
        'disposable_replace_first',
        'Single-use packaging & replace-on-fault',
        'Purchasing disposable single-serving packaging and discarding minor-fault items.',
        'Neutral effect on immediate personal outdoor AQI exposure.',
        'Minimal direct neighborhood tailpipe effect unless local waste is incinerated/burned nearby.',
        'Substantially higher landfill volume, plastic/cardboard waste, and upstream factory energy demand.',
      ),
    ],
    defaultBaselineId: 'disposable_replace_first',
    evidenceReference: EVIDENCE_CATALOG.epaMaterialsManagement,
  });

  // 9. CONSUMPTION & WASTE HABITS: Responsible segregation & avoiding open waste burning
  items.push({
    id: 'consumption-waste-segregation-no-burning',
    category: 'consumption_waste',
    categoryLabel: CATEGORY_LABEL_MAP.consumption_waste,
    title: 'Segregate household waste & strictly avoid burning plastics, treated wood, or trash',
    currentHabitMatched: `Location (${location.city}, ${location.country}) · Municipal disposal`,
    impactClassification: 'local_emissions',
    impactClassificationLabel: IMPACT_LABEL_MAP.local_emissions,
    affordabilityTier: 'zero_cost',
    affordabilityLabel: AFFORDABILITY_LABEL_MAP.zero_cost,
    relevanceScope: 'outdoor',
    relevanceLabel: RELEVANCE_LABEL_MAP.outdoor,
    ...formatSuitability(
      'conditional',
      `Zero-cost household sorting, conditional on municipal recycling, organic, and hazardous e-waste drop-off systems in ${location.city}.`,
    ),
    personalizationDrivers: [
      `Location (${location.city}, ${location.country})`,
      `Zone (${profile.locationPreferences.primaryZoneType.replaceAll('_', ' ')})`,
    ],
    currentChoice:
      'Mixing recyclables, batteries/paint, and general trash together—or burning household packaging, scrap wood, or rubbish outdoors or in stoves.',
    suggestedAlternative:
      'Sort paper/glass/metals/organics according to municipal rules, take batteries/solvents/e-waste to designated collection points, and never burn waste materials.',
    whyPreferable:
      'Open or domestic burning of plastics, coated paper, and treated wood emits severe local toxic pollutants (PM2.5, dioxins, HCl, heavy metals) directly at breathing height, while proper sorting keeps toxic fractions out of waste streams.',
    directAqVsBroaderNote:
      'Avoiding open/stove waste burning delivers major direct local air pollutant reductions (local_emissions); routine bin sorting without burning shifts primarily toward broader waste circularity.',
    ghgVsLocalPollutantNote:
      'Stops immediate neighborhood toxic smoke and ash particulates separately from landfill methane or material recycling benefits.',
    tradeoffsAndLimitations:
      'Requires space for separate bins at home and transport to municipal hazardous-waste drop-off centers where curbside collection is absent.',
    costAndAccessibilityNote:
      'Zero cost where curbside municipal bins exist; hazardous/e-waste drop-off may require periodic travel.',
    infrastructureConditionality: `Hazardous/e-waste and organic waste collection schedules depend on ${location.city} municipal services.`,
    qualitativeComparisonNote:
      'Prevents toxic uncontrolled waste-smoke plumes and improves formal material recovery without speculative tonnage estimates.',
    baselineOptions: [
      buildBaseline(
        'open_or_stove_waste_burning',
        'Burning packaging, treated wood, or household trash',
        'Disposing of cardboard, plastics, or painted scrap in backyard fires or home stoves.',
        'Exposes household members and neighbors directly to dense acrid smoke and toxic gases.',
        'Very high local PM2.5, carbon monoxide, volatile toxins, and persistent soot emissions.',
        'Destroys recoverable materials and leaves toxic ash.',
      ),
      buildBaseline(
        'unsorted_mixed_landfill',
        'Unsorted mixed-waste disposal',
        'Placing recyclables, batteries, and organics into one general landfill bin without burning.',
        'Minimal direct neighborhood smoke impact if landfill is remote.',
        'Low direct immediate local emission; secondary collection truck transport remains.',
        'Loses recyclable materials and risks battery/solvent leaching in waste facilities.',
      ),
    ],
    defaultBaselineId: 'unsorted_mixed_landfill',
    evidenceReference: EVIDENCE_CATALOG.epaMaterialsManagement,
  });

  // Order deterministically: recommended first, then conditional, then not_advised_now, matching user's focus where tied
  const statusWeight: Readonly<Record<AlternativeSuitabilityStatus, number>> = {
    recommended: 0,
    conditional: 1,
    not_advised_now: 2,
  };

  const focus = profile.lifestylePreferences.preferredGuidanceFocus;
  const categoryFocusBoost = (cat: AlternativeCategory): number => {
    if (focus === 'commute_exposure' && cat === 'transportation') return -1;
    if (
      focus === 'indoor_air' &&
      (cat === 'household_energy_heating' || cat === 'everyday_activities')
    ) {
      return -1;
    }
    if (focus === 'low_emission_habits') return -0.5;
    return 0;
  };

  return [...items].sort((a, b) => {
    const rankDiff =
      statusWeight[a.suitabilityStatus] +
      categoryFocusBoost(a.category) -
      (statusWeight[b.suitabilityStatus] + categoryFocusBoost(b.category));
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return a.id.localeCompare(b.id);
  });
}

export function filterAlternatives(
  catalog: readonly SustainableAlternativeItem[],
  query: AlternativesQueryInput,
): readonly SustainableAlternativeItem[] {
  return catalog.filter((item) => {
    if (query.category && item.category !== query.category) {
      return false;
    }
    if (query.affordability && item.affordabilityTier !== query.affordability) {
      return false;
    }
    if (query.relevance && item.relevanceScope !== query.relevance) {
      return false;
    }
    if (query.impactType && item.impactClassification !== query.impactType) {
      return false;
    }
    if (query.practicality && item.suitabilityStatus !== query.practicality) {
      return false;
    }
    return true;
  });
}

export function countByCategory(
  items: readonly SustainableAlternativeItem[],
): Readonly<Record<AlternativeCategory, number>> {
  const counts: Record<AlternativeCategory, number> = {
    transportation: 0,
    household_energy_heating: 0,
    everyday_activities: 0,
    consumption_waste: 0,
  };
  for (const item of items) {
    counts[item.category] += 1;
  }
  return counts;
}

export function countByImpact(
  items: readonly SustainableAlternativeItem[],
): Readonly<Record<AlternativeImpactClassification, number>> {
  const counts: Record<AlternativeImpactClassification, number> = {
    local_emissions: 0,
    personal_exposure: 0,
    both_exposure_and_emissions: 0,
    broader_sustainability: 0,
  };
  for (const item of items) {
    counts[item.impactClassification] += 1;
  }
  return counts;
}
