import { z } from 'zod';
import { isDecimal, isLocalDate, MEAL_SLOTS, NUTRIENT_KEYS } from '@daily-plate/domain';

export const SCHEMA_VERSION = 1 as const;

/* ---------- primitives ---------- */

export const DecimalSchema = z.string().refine(isDecimal, 'must be a decimal string like "22.5"');
export const PositiveDecimalSchema = DecimalSchema.refine((v) => Number(v) > 0, 'must be positive');
export const NonNegativeDecimalSchema = DecimalSchema.refine((v) => Number(v) >= 0, 'must not be negative');
export const LocalDateSchema = z.string().refine(isLocalDate, 'must be YYYY-MM-DD');
export const InstantSchema = z.iso.datetime({ offset: true });
export const IdSchema = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const UuidSchema = z.uuid();
/** Portion ids are local to one food version; short human names are fine. */
export const PortionIdSchema = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/);
export const ShortTextSchema = z.string().trim().min(1).max(120);
export const LongTextSchema = z.string().trim().max(2000);
export const TimeZoneSchema = z.string().min(1).max(64);

export const NutrientKeySchema = z.enum(NUTRIENT_KEYS);
export const MealSlotSchema = z.enum(MEAL_SLOTS as [string, ...string[]]);
export const DayTypeSchema = z.enum(['rest', 'training']);
export const PreparationSchema = z.enum(['unspecified', 'as-sold', 'raw', 'cooked', 'dry', 'prepared', 'drained', 'undrained']);

/* ---------- nutrients ---------- */

export const NutrientValueSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('reported'), amount: NonNegativeDecimalSchema }),
  z.object({ status: z.literal('estimated'), amount: NonNegativeDecimalSchema }),
  z.object({ status: z.literal('less-than'), amount: PositiveDecimalSchema }),
  z.object({ status: z.literal('unknown') }),
]);

export const NutrientSetSchema = z.object({
  protein: NutrientValueSchema,
  carbs: NutrientValueSchema,
  fat: NutrientValueSchema,
  fiber: NutrientValueSchema,
  sugar: NutrientValueSchema,
  calories: NutrientValueSchema,
});

/* ---------- quantities ---------- */

export const NutrientBasisSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('serving'), servingText: ShortTextSchema, servingGrams: PositiveDecimalSchema.optional(), servingMl: PositiveDecimalSchema.optional() }),
  z.object({ kind: z.literal('per100g') }),
  z.object({ kind: z.literal('per100ml') }),
]);

export const PortionSchema = z
  .object({
    id: PortionIdSchema,
    name: ShortTextSchema,
    servings: PositiveDecimalSchema.optional(),
    grams: PositiveDecimalSchema.optional(),
    ml: PositiveDecimalSchema.optional(),
  })
  .refine((p) => [p.servings, p.grams, p.ml].filter((v) => v !== undefined).length === 1, 'a portion needs exactly one of servings, grams or ml');

export const QuantityUnitSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('serving') }),
  z.object({ kind: z.literal('portion'), portionId: PortionIdSchema }),
  z.object({ kind: z.literal('mass'), unit: z.enum(['g', 'oz']) }),
  z.object({ kind: z.literal('volume'), unit: z.enum(['ml', 'floz']) }),
]);

export const QuantitySchema = z.object({ amount: PositiveDecimalSchema, unit: QuantityUnitSchema });

/* ---------- foods ---------- */

export const ProviderSchema = z.enum(['user', 'usda', 'off', 'recipe']);
export const SourceBadgeSchema = z.enum(['Your label', 'USDA', 'Product database', 'Your recipe']);

export const ProvenanceSchema = z.object({
  provider: ProviderSchema,
  providerId: z.string().max(120).optional(),
  fetchedAt: InstantSchema,
  sourceServingText: z.string().max(200).optional(),
  normalizationVersion: z.string().max(40),
  attribution: z.string().max(300).optional(),
  /** Nutrients the user corrected by hand on top of a provider record. */
  userCorrected: z.array(NutrientKeySchema).optional(),
  /** Raw payload reference in the provider cache (never the payload itself). */
  rawRef: z.string().max(200).optional(),
});

export const FoodVersionSchema = z.object({
  id: IdSchema,
  foodId: IdSchema,
  version: z.number().int().positive(),
  name: ShortTextSchema,
  brand: ShortTextSchema.optional(),
  barcode: z.string().regex(/^\d{6,14}$/).optional(),
  preparation: PreparationSchema,
  basis: NutrientBasisSchema,
  nutrients: NutrientSetSchema,
  portions: z.array(PortionSchema).max(12),
  defaultQuantity: QuantitySchema.optional(),
  provenance: ProvenanceSchema,
  createdAt: InstantSchema,
});

export const PinSchema = z.object({ order: z.number().int().min(0), quantity: QuantitySchema });

export const FoodSchema = z.object({
  id: IdSchema,
  name: ShortTextSchema,
  aliases: z.array(ShortTextSchema).max(10),
  currentVersionId: IdSchema,
  pin: PinSchema.nullable(),
  suggestEligible: z.boolean(),
  tags: z.array(z.enum(['alcohol', 'drink', 'supplement'])).max(5),
  hidden: z.boolean(),
  /** Last deliberately chosen quantity; may be proposed as a default, never forced. */
  lastQuantity: QuantitySchema.optional(),
  revision: z.number().int().positive(),
  updatedAt: InstantSchema,
});

/* ---------- diary ---------- */

export const DiarySnapshotSchema = z.object({
  name: ShortTextSchema,
  brand: ShortTextSchema.optional(),
  sourceBadge: SourceBadgeSchema,
  preparation: PreparationSchema,
  /** Nutrients already scaled to the logged quantity. */
  nutrients: NutrientSetSchema,
  quantityLabel: ShortTextSchema,
});

export const DiaryDraftSchema = z.object({ text: ShortTextSchema, note: LongTextSchema.optional() });

export const DiaryEntrySchema = z.object({
  id: IdSchema,
  localDate: LocalDateSchema,
  timeZone: TimeZoneSchema,
  occurredAt: InstantSchema,
  mealSlot: MealSlotSchema,
  kind: z.enum(['food', 'draft']),
  foodId: IdSchema.optional(),
  foodVersionId: IdSchema.optional(),
  quantity: QuantitySchema.optional(),
  factor: PositiveDecimalSchema.optional(),
  snapshot: DiarySnapshotSchema.optional(),
  draft: DiaryDraftSchema.optional(),
  /** Entries logged together from a saved meal share a group id. */
  groupId: IdSchema.optional(),
  revision: z.number().int().positive(),
  deleted: z.boolean(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});

/* ---------- meals / recipes ---------- */

export const SavedMealItemSchema = z.object({ foodId: IdSchema, foodVersionId: IdSchema, quantity: QuantitySchema });

export const SavedMealSchema = z.object({
  id: IdSchema,
  name: ShortTextSchema,
  items: z.array(SavedMealItemSchema).min(1).max(20),
  pin: z.object({ order: z.number().int().min(0) }).nullable(),
  suggestEligible: z.boolean(),
  revision: z.number().int().positive(),
  deleted: z.boolean(),
  updatedAt: InstantSchema,
});

export const RecipeIngredientSchema = z.object({ foodId: IdSchema, foodVersionId: IdSchema, quantity: QuantitySchema, factor: PositiveDecimalSchema });

export const RecipeVersionSchema = z.object({
  id: IdSchema,
  recipeId: IdSchema,
  version: z.number().int().positive(),
  name: ShortTextSchema,
  ingredients: z.array(RecipeIngredientSchema).min(1).max(40),
  yieldServings: PositiveDecimalSchema,
  servingName: ShortTextSchema,
  perServing: NutrientSetSchema,
  incomplete: z.array(NutrientKeySchema),
  /** The food version created for logging this recipe version. */
  foodVersionId: IdSchema,
  createdAt: InstantSchema,
});

export const RecipeSchema = z.object({
  id: IdSchema,
  name: ShortTextSchema,
  foodId: IdSchema,
  currentVersionId: IdSchema,
  revision: z.number().int().positive(),
  deleted: z.boolean(),
  updatedAt: InstantSchema,
});

/* ---------- goals / user ---------- */

export const MacroTargetsSchema = z.object({ protein: PositiveDecimalSchema, carbs: PositiveDecimalSchema, fat: PositiveDecimalSchema });
export const SecondaryTargetsSchema = z.object({ fiber: PositiveDecimalSchema.optional(), sugar: PositiveDecimalSchema.optional() });

export const GoalTemplateSchema = z.object({
  rest: MacroTargetsSchema,
  training: MacroTargetsSchema,
  secondary: SecondaryTargetsSchema,
  revision: z.number().int().positive(),
  updatedAt: InstantSchema,
});

export const DaySnapshotSchema = z.object({
  localDate: LocalDateSchema,
  dayType: DayTypeSchema,
  targets: MacroTargetsSchema,
  secondary: SecondaryTargetsSchema,
  templateRevision: z.number().int().positive(),
  revision: z.number().int().positive(),
  updatedAt: InstantSchema,
});

export const UserSchema = z.object({
  id: IdSchema,
  displayName: ShortTextSchema,
  timeZone: TimeZoneSchema,
  trainingWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
  setupConfirmedAt: InstantSchema.nullable(),
  revision: z.number().int().positive(),
});

export const DismissalSchema = z.object({ key: z.string().min(1).max(400), kind: z.enum(['meal-combo', 'suggestion']), createdAt: InstantSchema });

/* ---------- mutations ---------- */

const NewEntry = DiaryEntrySchema.omit({ revision: true, deleted: true, createdAt: true, updatedAt: true });
const NewFood = FoodSchema.omit({ revision: true, updatedAt: true, currentVersionId: true });
const NewFoodVersion = FoodVersionSchema.omit({ id: true, foodId: true, version: true, createdAt: true });

export const MutationPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('diary.add'), entry: NewEntry }),
  z.object({ type: z.literal('diary.update'), entryId: IdSchema, baseRevision: z.number().int().positive(), entry: NewEntry }),
  z.object({ type: z.literal('diary.delete'), entryId: IdSchema, baseRevision: z.number().int().positive() }),
  z.object({ type: z.literal('diary.restore'), entryId: IdSchema, baseRevision: z.number().int().positive() }),
  z.object({ type: z.literal('food.upsert'), food: NewFood, version: NewFoodVersion, baseRevision: z.number().int().positive().optional() }),
  z.object({
    type: z.literal('food.update'),
    foodId: IdSchema,
    baseRevision: z.number().int().positive(),
    changes: z.object({
      name: ShortTextSchema.optional(),
      aliases: z.array(ShortTextSchema).max(10).optional(),
      pin: PinSchema.nullable().optional(),
      suggestEligible: z.boolean().optional(),
      hidden: z.boolean().optional(),
      tags: z.array(z.enum(['alcohol', 'drink', 'supplement'])).max(5).optional(),
      lastQuantity: QuantitySchema.optional(),
    }),
  }),
  z.object({ type: z.literal('meal.upsert'), meal: SavedMealSchema.omit({ revision: true, deleted: true, updatedAt: true }), baseRevision: z.number().int().positive().optional() }),
  z.object({ type: z.literal('meal.delete'), mealId: IdSchema, baseRevision: z.number().int().positive() }),
  z.object({
    type: z.literal('recipe.upsert'),
    recipeId: IdSchema,
    name: ShortTextSchema,
    ingredients: z.array(z.object({ foodId: IdSchema, foodVersionId: IdSchema, quantity: QuantitySchema })).min(1).max(40),
    yieldServings: PositiveDecimalSchema,
    servingName: ShortTextSchema,
    baseRevision: z.number().int().positive().optional(),
  }),
  z.object({ type: z.literal('recipe.delete'), recipeId: IdSchema, baseRevision: z.number().int().positive() }),
  z.object({ type: z.literal('day.setType'), localDate: LocalDateSchema, dayType: DayTypeSchema }),
  z.object({ type: z.literal('goals.update'), rest: MacroTargetsSchema, training: MacroTargetsSchema, secondary: SecondaryTargetsSchema, baseRevision: z.number().int().positive() }),
  z.object({
    type: z.literal('user.update'),
    baseRevision: z.number().int().positive(),
    changes: z.object({ displayName: ShortTextSchema.optional(), timeZone: TimeZoneSchema.optional(), trainingWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(), setupConfirmed: z.literal(true).optional() }),
  }),
  z.object({ type: z.literal('dismissal.add'), key: z.string().min(1).max(400), kind: z.enum(['meal-combo', 'suggestion']) }),
]);

export const MutationSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  mutationId: UuidSchema,
  clientTime: InstantSchema,
  payload: MutationPayloadSchema,
});

export const MutationBatchSchema = z.object({ mutations: z.array(MutationSchema).min(1).max(50) });

export const EntityTypeSchema = z.enum(['entry', 'food', 'foodVersion', 'meal', 'recipe', 'recipeVersion', 'day', 'goals', 'user', 'dismissal']);

export const ReceiptSchema = z.object({
  mutationId: UuidSchema,
  entityType: EntityTypeSchema,
  entityId: IdSchema.or(z.string().max(64)),
  revision: z.number().int().positive(),
  seq: z.number().int().positive(),
  committedAt: InstantSchema,
});

export const MutationErrorCodeSchema = z.enum(['invalid', 'not-found', 'conflict', 'forbidden', 'payload-mismatch', 'incompatible-quantity', 'storage']);

export const MutationResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('committed'), mutationId: UuidSchema, receipt: ReceiptSchema }),
  z.object({ status: z.literal('duplicate'), mutationId: UuidSchema, receipt: ReceiptSchema }),
  z.object({ status: z.literal('conflict'), mutationId: UuidSchema, error: z.object({ code: z.literal('conflict'), message: z.string() }), current: z.unknown() }),
  z.object({ status: z.literal('rejected'), mutationId: UuidSchema, error: z.object({ code: MutationErrorCodeSchema, message: z.string() }) }),
]);

export const MutationBatchResponseSchema = z.object({ results: z.array(MutationResultSchema), cursor: z.number().int().min(0) });

/* ---------- change feed / bootstrap ---------- */

export const ChangeSchema = z.object({
  seq: z.number().int().positive(),
  entityType: EntityTypeSchema,
  entityId: z.string().max(64),
  revision: z.number().int().positive(),
  deleted: z.boolean(),
  data: z.unknown(),
});

export const ChangesResponseSchema = z.object({ changes: z.array(ChangeSchema), cursor: z.number().int().min(0), more: z.boolean() });

export const BootstrapSchema = z.object({
  serverVersion: z.string(),
  user: UserSchema,
  goals: GoalTemplateSchema,
  foods: z.array(FoodSchema),
  foodVersions: z.array(FoodVersionSchema),
  meals: z.array(SavedMealSchema),
  recipes: z.array(RecipeSchema),
  recipeVersions: z.array(RecipeVersionSchema),
  days: z.array(DaySnapshotSchema),
  entries: z.array(DiaryEntrySchema),
  dismissals: z.array(DismissalSchema),
  cursor: z.number().int().min(0),
  /** Local dates covered by `entries`; older days are fetched on demand. */
  window: z.object({ from: LocalDateSchema, to: LocalDateSchema }),
});

/* ---------- search ---------- */

export const FoodCandidateSchema = z.object({
  provider: z.enum(['usda', 'off']),
  providerId: z.string().max(120),
  name: ShortTextSchema,
  brand: ShortTextSchema.optional(),
  barcode: z.string().regex(/^\d{6,14}$/).optional(),
  preparation: PreparationSchema,
  basis: NutrientBasisSchema,
  nutrients: NutrientSetSchema,
  portions: z.array(PortionSchema).max(12),
  sourceServingText: z.string().max(200).optional(),
  attribution: z.string().max(300),
  normalizationVersion: z.string().max(40),
  /** True when the adapter could not establish carbohydrate/fiber semantics; needs label confirmation. */
  needsLabelConfirmation: z.boolean(),
  warnings: z.array(z.string().max(200)),
});

export const SearchResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local'), foodId: IdSchema, matchedAlias: z.string().optional() }),
  z.object({ kind: z.literal('candidate'), candidate: FoodCandidateSchema }),
]);

export const SearchResponseSchema = z.object({
  query: z.string(),
  mode: z.enum(['local', 'online']),
  results: z.array(SearchResultSchema),
  providerStatus: z.enum(['ok', 'unavailable', 'throttled', 'not-configured', 'skipped']),
});

export const BarcodeResponseSchema = z.object({
  barcode: z.string(),
  local: z.array(IdSchema),
  candidate: FoodCandidateSchema.nullable(),
  providerStatus: z.enum(['ok', 'not-found', 'unavailable', 'throttled', 'not-configured']),
});

export const DayResponseSchema = z.object({ day: DaySnapshotSchema.nullable(), entries: z.array(DiaryEntrySchema) });

/* ---------- auth ---------- */

export const InviteRedeemSchema = z.object({ token: z.string().min(20).max(200), displayName: ShortTextSchema.optional(), timeZone: TimeZoneSchema.optional() });

export const SessionInfoSchema = z.object({
  authenticated: z.boolean(),
  userId: IdSchema.optional(),
  displayName: z.string().optional(),
  passkeyCount: z.number().int().min(0).optional(),
  expiresAt: InstantSchema.optional(),
});

export const ExportRequestSchema = z.object({ from: LocalDateSchema.optional(), to: LocalDateSchema.optional() });

/* ---------- inferred types ---------- */

export type NutrientValueDto = z.infer<typeof NutrientValueSchema>;
export type NutrientSetDto = z.infer<typeof NutrientSetSchema>;
export type Portion = z.infer<typeof PortionSchema>;
export type Quantity = z.infer<typeof QuantitySchema>;
export type QuantityUnit = z.infer<typeof QuantityUnitSchema>;
export type NutrientBasis = z.infer<typeof NutrientBasisSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type Food = z.infer<typeof FoodSchema>;
export type FoodVersion = z.infer<typeof FoodVersionSchema>;
export type Pin = z.infer<typeof PinSchema>;
export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;
export type DiarySnapshot = z.infer<typeof DiarySnapshotSchema>;
export type SavedMeal = z.infer<typeof SavedMealSchema>;
export type SavedMealItem = z.infer<typeof SavedMealItemSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeVersion = z.infer<typeof RecipeVersionSchema>;
export type GoalTemplateDto = z.infer<typeof GoalTemplateSchema>;
export type DaySnapshot = z.infer<typeof DaySnapshotSchema>;
export type User = z.infer<typeof UserSchema>;
export type Dismissal = z.infer<typeof DismissalSchema>;
export type MutationPayload = z.infer<typeof MutationPayloadSchema>;
export type Mutation = z.infer<typeof MutationSchema>;
export type MutationResult = z.infer<typeof MutationResultSchema>;
export type MutationBatchResponse = z.infer<typeof MutationBatchResponseSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type Change = z.infer<typeof ChangeSchema>;
export type ChangesResponse = z.infer<typeof ChangesResponseSchema>;
export type Bootstrap = z.infer<typeof BootstrapSchema>;
export type FoodCandidate = z.infer<typeof FoodCandidateSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type BarcodeResponse = z.infer<typeof BarcodeResponseSchema>;
export type DayResponse = z.infer<typeof DayResponseSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type SourceBadge = z.infer<typeof SourceBadgeSchema>;
export type MealSlot = z.infer<typeof MealSlotSchema>;
export type DayType = z.infer<typeof DayTypeSchema>;
export type NewDiaryEntry = z.infer<typeof NewEntry>;
export type NewFood = z.infer<typeof NewFood>;
export type NewFoodVersion = z.infer<typeof NewFoodVersion>;

export const SOURCE_BADGE_BY_PROVIDER: Record<Provenance['provider'], SourceBadge> = {
  user: 'Your label',
  usda: 'USDA',
  off: 'Product database',
  recipe: 'Your recipe',
};
export * from './helpers.js';
