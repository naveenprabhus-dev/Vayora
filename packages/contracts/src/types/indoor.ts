import type {
  IndoorActionStatus,
  IndoorInformationCategory,
  IndoorPollutionSourceId,
  IndoorScenarioId,
  IndoorVentilationState,
} from '../schemas/indoor.schema.ts';
import type { HouseholdLifestyleRecord } from '../schemas/profile.schema.ts';
import type {
  AirQualityLocationSummary,
  AqiReadingSummary,
  DataTransparencyInfo,
  DominantPollutantSummary,
  PollutantDetail,
} from './air-quality.ts';

export interface IndoorEvidenceDistinctionItem {
  readonly category: IndoorInformationCategory;
  readonly label: string;
  readonly statusLabel: string;
  readonly description: string;
}

export interface IndoorSensorStatus {
  readonly sensorConnected: false;
  readonly disclosureStatement: string;
  readonly evidenceDistinctions: readonly IndoorEvidenceDistinctionItem[];
}

export interface IndoorEnvironmentOverview {
  readonly headline: string;
  readonly summary: string;
  readonly householdSize: number;
  readonly householdComposition: readonly HouseholdLifestyleRecord['householdComposition'][number][];
  readonly ventilationContext: HouseholdLifestyleRecord['ventilationContext'];
  readonly hasIndoorAirPurifier: boolean;
  readonly heatingType: HouseholdLifestyleRecord['heatingType'];
  readonly primaryZoneType: HouseholdLifestyleRecord['locationPreferences']['primaryZoneType'];
  readonly outdoorConditionSummary: string;
  readonly sensorStatus: IndoorSensorStatus;
}

export interface VentilationGuidanceSummary {
  readonly state: IndoorVentilationState;
  readonly stateLabel: string;
  readonly headline: string;
  readonly summary: string;
  readonly bestWindowHint: string | null;
  readonly windowDisclosure: string;
  readonly essentialSafetyReminder: string;
  readonly constraintsAndTradeoffs: readonly string[];
  readonly informationCategory: Exclude<IndoorInformationCategory, 'measured_indoor'>;
}

export interface AirPurifierGuidanceSummary {
  readonly hasPurifier: boolean;
  readonly scenarioSimulatedPurifier: boolean;
  readonly headline: string;
  readonly summary: string;
  readonly practicalGuidance: readonly string[];
  readonly gasAndVocLimitation: string;
  readonly nonPurchaseNote: string | null;
  readonly informationCategory: Exclude<IndoorInformationCategory, 'measured_indoor'>;
}

export interface IndoorPollutionSourceGuide {
  readonly id: IndoorPollutionSourceId;
  readonly title: string;
  readonly whatItIs: string;
  readonly howItAffectsIndoorAir: string;
  readonly practicalReductionSteps: readonly string[];
  readonly relevantPrecautions: readonly string[];
  readonly limitations: string;
  readonly informationCategory: 'general_educational_guidance';
  readonly sourceReference: string;
}

export interface IndoorActionPlanItem {
  readonly id: string;
  readonly title: string;
  readonly status: IndoorActionStatus;
  readonly statusLabel: string;
  readonly priorityScore: number;
  readonly informationCategory: Exclude<IndoorInformationCategory, 'measured_indoor'>;
  readonly informationCategoryLabel: string;
  readonly whatToDo: string;
  readonly whyRecommended: string;
  readonly householdAndOutdoorContext: readonly string[];
  readonly precautionAndSafety: string;
  readonly limitations: string;
  readonly highlightedByScenario: boolean;
}

export interface IndoorScenarioOption {
  readonly id: IndoorScenarioId;
  readonly label: string;
  readonly shortDescription: string;
}

export interface IndoorScenarioSummary {
  readonly selectedScenario: IndoorScenarioId;
  readonly isSimulation: boolean;
  readonly simulationLabel: string;
  readonly scenarioTitle: string;
  readonly scenarioDescription: string;
  readonly scenarioFocusNotes: readonly string[];
  readonly availableScenarios: readonly IndoorScenarioOption[];
}

export interface IndoorProvenanceAndSafety {
  readonly dataSources: readonly string[];
  readonly nonMedicalNotice: string;
  readonly limitationsSummary: string;
}

export interface IndoorAirGuidanceResponse {
  readonly guidanceId: string;
  readonly generatedAt: string;
  readonly cachedResult: boolean;
  readonly location: AirQualityLocationSummary;
  readonly overview: IndoorEnvironmentOverview;
  readonly airQualityContext: {
    readonly usAqi: AqiReadingSummary;
    readonly europeanAqi: AqiReadingSummary;
    readonly dominantPollutant: DominantPollutantSummary;
    readonly pollutants: readonly PollutantDetail[];
    readonly transparency: DataTransparencyInfo;
  };
  readonly scenarioContext: IndoorScenarioSummary;
  readonly ventilationGuidance: VentilationGuidanceSummary;
  readonly purifierGuidance: AirPurifierGuidanceSummary;
  readonly actionPlan: readonly IndoorActionPlanItem[];
  readonly pollutionSources: readonly IndoorPollutionSourceGuide[];
  readonly provenanceAndSafety: IndoorProvenanceAndSafety;
}
