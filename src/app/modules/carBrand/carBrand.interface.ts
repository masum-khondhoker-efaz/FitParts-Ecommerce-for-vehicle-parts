export interface EngineInput {
    id ?: string;
  engineCode?: string;
  kw?: number;
  hp?: number;
  ccm?: number;
  fuelType?: string;
}

export interface GenerationInput {
    id ?: string;
  generationName?: string;
  body?: string;
  productionStart?: string;
  productionEnd?: string;
  engines?: EngineInput[];
}

export interface ModelInput {
    id ?: string;
  modelName?: string;
  generations?: GenerationInput[];
}

export interface BrandInput {
 id ?: string;
  brandName?: string;
  iconName?: string;
  models?: ModelInput[];
}
