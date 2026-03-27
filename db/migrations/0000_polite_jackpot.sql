DO $$ BEGIN
 CREATE TYPE "public"."game_status" AS ENUM('WAITING', 'IN_PROGRESS', 'COMPLETED', 'CRASHED', 'DISPUTED', 'ABANDONED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."kyc_status" AS ENUM('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payout_status" AS ENUM('PENDING', 'HELD_ANTICHEAT', 'RELEASED', 'DISPUTED', 'REFUNDED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."queue_status" AS ENUM('WAITING', 'MATCHED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."result_reason" AS ENUM('CHECKMATE', 'TIMEOUT', 'RESIGNATION', 'DRAW_AGREEMENT', 'DRAW_STALEMATE', 'DRAW_INSUFFICIENT', 'DRAW_REPETITION', 'DRAW_FIFTY_MOVE', 'FORFEIT_DISCONNECT', 'FORFEIT_ILLEGAL_MOVES', 'ADMIN_OVERRIDE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."review_outcome" AS ENUM('CLEARED', 'CONFIRMED_CHEAT', 'INCONCLUSIVE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."txn_status" AS ENUM('PENDING_ESCROW', 'SETTLED', 'FAILED', 'REVERSED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."txn_type" AS ENUM('DEPOSIT', 'WITHDRAWAL', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'WAGER_WIN', 'WAGER_LOSS', 'RAKE', 'REFUND', 'ADJUSTMENT', 'BONUS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"elo_rating" integer DEFAULT 1200 NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"kyc_provider_ref" text,
	"date_of_birth" date,
	"country_code" char(2),
	"ip_country_last" char(2),
	"account_flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"stripe_customer_id" text,
	"refresh_token_hash" text,
	"last_login_at" timestamp with time zone,
	"last_login_ip" text,
	"is_banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"move_number" integer NOT NULL,
	"uci_move" text NOT NULL,
	"san" text NOT NULL,
	"fen_after" text NOT NULL,
	"time_remaining_ms" integer NOT NULL,
	"elapsed_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"white_user_id" uuid NOT NULL,
	"black_user_id" uuid NOT NULL,
	"wager_amount" numeric(12, 2) NOT NULL,
	"rake_percent" numeric(4, 2) DEFAULT '7.50' NOT NULL,
	"pot_total" numeric(12, 2) NOT NULL,
	"status" "game_status" DEFAULT 'WAITING' NOT NULL,
	"winner_user_id" uuid,
	"result_reason" "result_reason",
	"fen_snapshot" text DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' NOT NULL,
	"pgn" text,
	"time_control" jsonb DEFAULT '{"baseSecs":600,"incrementSecs":5}' NOT NULL,
	"payout_status" "payout_status" DEFAULT 'PENDING' NOT NULL,
	"payout_release_at" timestamp with time zone,
	"disconnected_at" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid,
	"original_txn_id" uuid,
	"txn_type" "txn_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "txn_status" NOT NULL,
	"stripe_ref" text,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "ledger_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anticheat_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"analyzed_user_id" uuid NOT NULL,
	"centipawn_loss_avg" numeric(6, 2),
	"top_engine_move_match_pct" numeric(5, 2),
	"stockfish_depth" integer,
	"tab_switch_count" integer DEFAULT 0 NOT NULL,
	"move_timing_stddev_ms" numeric(8, 2),
	"flag_triggered" boolean DEFAULT false NOT NULL,
	"flag_reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"reviewed_by" uuid,
	"review_outcome" "review_outcome",
	"review_notes" text,
	"reviewed_at" timestamp with time zone,
	"analysis_status" text DEFAULT 'QUEUED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "anticheat_reports_game_id_unique" UNIQUE("game_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matchmaking_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"elo_at_queue" integer NOT NULL,
	"elo_range" integer DEFAULT 100 NOT NULL,
	"wager_amount" numeric(12, 2) NOT NULL,
	"time_control" jsonb NOT NULL,
	"status" "queue_status" DEFAULT 'WAITING' NOT NULL,
	"matched_game_id" uuid,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchmaking_queue_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_white_user_id_users_id_fk" FOREIGN KEY ("white_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_black_user_id_users_id_fk" FOREIGN KEY ("black_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "games" ADD CONSTRAINT "games_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anticheat_reports" ADD CONSTRAINT "anticheat_reports_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anticheat_reports" ADD CONSTRAINT "anticheat_reports_analyzed_user_id_users_id_fk" FOREIGN KEY ("analyzed_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anticheat_reports" ADD CONSTRAINT "anticheat_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matchmaking_queue" ADD CONSTRAINT "matchmaking_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matchmaking_queue" ADD CONSTRAINT "matchmaking_queue_matched_game_id_games_id_fk" FOREIGN KEY ("matched_game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_elo_idx" ON "users" USING btree ("elo_rating");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_moves_game_id_idx" ON "game_moves" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_moves_game_user_idx" ON "game_moves" USING btree ("game_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_moves_number_idx" ON "game_moves" USING btree ("game_id","move_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_white_user_idx" ON "games" USING btree ("white_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_black_user_idx" ON "games" USING btree ("black_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_status_idx" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_payout_status_idx" ON "games" USING btree ("payout_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_created_at_idx" ON "games" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_user_id_idx" ON "ledger_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_game_id_idx" ON "ledger_transactions" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_status_idx" ON "ledger_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_txn_type_idx" ON "ledger_transactions" USING btree ("txn_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_idempotency_key_idx" ON "ledger_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_created_at_idx" ON "ledger_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_user_status_idx" ON "ledger_transactions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "anticheat_game_id_idx" ON "anticheat_reports" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anticheat_user_id_idx" ON "anticheat_reports" USING btree ("analyzed_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anticheat_flag_idx" ON "anticheat_reports" USING btree ("flag_triggered");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anticheat_review_outcome_idx" ON "anticheat_reports" USING btree ("review_outcome");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "queue_user_id_idx" ON "matchmaking_queue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "queue_status_idx" ON "matchmaking_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "queue_wager_elo_idx" ON "matchmaking_queue" USING btree ("wager_amount","elo_at_queue");