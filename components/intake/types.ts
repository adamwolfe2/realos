export type PropertyType = "RESIDENTIAL" | "COMMERCIAL" | "MIXED";
export type ResidentialSubtype =
  | "STUDENT_HOUSING"
  | "MULTIFAMILY"
  | "SENIOR_LIVING"
  | "SINGLE_FAMILY_RENTAL"
  | "CO_LIVING"
  | "SHORT_TERM_RENTAL";
export type CommercialSubtype =
  | "OFFICE"
  | "RETAIL"
  | "INDUSTRIAL"
  | "MIXED_USE"
  | "FLEX_SPACE"
  | "MEDICAL_OFFICE";
export type BackendPlatformKey =
  | "APPFOLIO"
  | "YARDI_BREEZE"
  | "YARDI_VOYAGER"
  | "BUILDIUM"
  | "RENTMANAGER"
  | "ENTRATA"
  | "REALPAGE"
  | "PROPERTYWARE"
  | "MRI"
  | "VTS"
  | "OTHER"
  | "NONE";
export type GoLiveTarget = "asap" | "one_month" | "three_months" | "exploring";

export type IntakeModules = {
  website: boolean;
  pixel: boolean;
  chatbot: boolean;
  googleAds: boolean;
  metaAds: boolean;
  seo: boolean;
  email: boolean;
  outboundEmail: boolean;
  referrals: boolean;
  creativeStudio: boolean;
  leadCapture: boolean;
};

export type Step1Data = {
  companyName: string;
  shortName: string;
  websiteUrl: string;
  propertyType: PropertyType | "";
  residentialSubtype?: ResidentialSubtype;
  commercialSubtype?: CommercialSubtype;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  primaryContactRole: string;
  hqCity: string;
  hqState: string;
};

export type Step2Data = {
  numberOfProperties: number | null;
  currentBackendPlatform: BackendPlatformKey | "";
  backendPlanTier: string;
  currentVendor: string;
  currentMonthlySpend: number | null;
  biggestPainPoint: string;
};

export type Step3Data = {
  modules: IntakeModules;
};

export type Step4Data = {
  goLiveTarget: GoLiveTarget | "";
  bookedCallAt?: string;
  calBookingId?: string;
};

export type IntakeFormState = Step1Data & Step2Data & Step3Data & Step4Data;

// Payload as submitted to /api/onboarding. Matches the Zod schema server-side.
export type IntakeSubmitPayload = {
  companyName: string;
  shortName?: string;
  websiteUrl?: string;
  propertyType: PropertyType;
  residentialSubtype?: ResidentialSubtype;
  commercialSubtype?: CommercialSubtype;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;
  primaryContactRole?: string;
  hqCity?: string;
  hqState?: string;

  numberOfProperties?: number | null;
  currentBackendPlatform?: BackendPlatformKey;
  backendPlanTier?: string;
  currentVendor?: string;
  currentMonthlySpendCents?: number | null;
  biggestPainPoint?: string;

  selectedModules: Array<keyof IntakeModules>;

  goLiveTarget?: GoLiveTarget;
  bookedCallAt?: string;
  calBookingId?: string;
};
