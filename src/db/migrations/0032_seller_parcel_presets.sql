CREATE TABLE "seller_parcel_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(140) NOT NULL,
	"weight_grams" numeric(12, 3) NOT NULL,
	"length_mm" numeric(12, 3) NOT NULL,
	"width_mm" numeric(12, 3) NOT NULL,
	"height_mm" numeric(12, 3) NOT NULL,
	"notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seller_parcel_presets" ADD CONSTRAINT "seller_parcel_presets_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "parcel_preset_id" uuid;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_parcel_preset_id_seller_parcel_presets_id_fk" FOREIGN KEY ("parcel_preset_id") REFERENCES "public"."seller_parcel_presets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "seller_parcel_presets_seller_id_idx" ON "seller_parcel_presets" USING btree ("seller_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "seller_parcel_presets_seller_name_unique" ON "seller_parcel_presets" USING btree ("seller_id","normalized_name");
--> statement-breakpoint
CREATE INDEX "product_variants_parcel_preset_id_idx" ON "product_variants" USING btree ("parcel_preset_id");
