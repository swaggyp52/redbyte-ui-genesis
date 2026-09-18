export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        training_weekdays TEXT NOT NULL DEFAULT '[]',
        setup_confirmed_at TEXT,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE invites (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT REFERENCES users(id),
        display_name TEXT,
        expires_at TEXT NOT NULL,
        redeemed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        idle_expires_at TEXT NOT NULL,
        absolute_expires_at TEXT NOT NULL,
        revoked_at TEXT,
        user_agent TEXT
      );
      CREATE INDEX sessions_user ON sessions(user_id);

      CREATE TABLE passkeys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        public_key BLOB NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        transports TEXT NOT NULL DEFAULT '[]',
        device_type TEXT,
        backed_up INTEGER NOT NULL DEFAULT 0,
        label TEXT,
        created_at TEXT NOT NULL,
        last_used_at TEXT
      );
      CREATE INDEX passkeys_user ON passkeys(user_id);

      CREATE TABLE challenges (
        id TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        challenge TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE goal_templates (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        rest TEXT NOT NULL,
        training TEXT NOT NULL,
        secondary TEXT NOT NULL DEFAULT '{}',
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE day_snapshots (
        user_id TEXT NOT NULL REFERENCES users(id),
        local_date TEXT NOT NULL,
        day_type TEXT NOT NULL,
        targets TEXT NOT NULL,
        secondary TEXT NOT NULL DEFAULT '{}',
        template_revision INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, local_date)
      );

      CREATE TABLE foods (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        data TEXT NOT NULL,
        name_lower TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        hidden INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX foods_user ON foods(user_id, hidden);

      CREATE TABLE food_versions (
        id TEXT PRIMARY KEY,
        food_id TEXT NOT NULL REFERENCES foods(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        version INTEGER NOT NULL,
        barcode TEXT,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (food_id, version)
      );
      CREATE INDEX food_versions_barcode ON food_versions(user_id, barcode);

      CREATE TABLE diary_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        local_date TEXT NOT NULL,
        data TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX diary_entries_user_date ON diary_entries(user_id, local_date);

      CREATE TABLE saved_meals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        data TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX saved_meals_user ON saved_meals(user_id);

      CREATE TABLE recipes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        data TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX recipes_user ON recipes(user_id);

      CREATE TABLE recipe_versions (
        id TEXT PRIMARY KEY,
        recipe_id TEXT NOT NULL REFERENCES recipes(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (recipe_id, version)
      );

      CREATE TABLE dismissals (
        user_id TEXT NOT NULL REFERENCES users(id),
        key TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, key)
      );

      CREATE TABLE mutation_receipts (
        user_id TEXT NOT NULL REFERENCES users(id),
        mutation_id TEXT NOT NULL,
        payload_digest TEXT NOT NULL,
        result TEXT NOT NULL,
        committed_at TEXT NOT NULL,
        PRIMARY KEY (user_id, mutation_id)
      );

      CREATE TABLE change_feed (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id),
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        data TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX change_feed_user_seq ON change_feed(user_id, seq);

      CREATE TABLE provider_cache (
        provider TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT,
        fetched_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        PRIMARY KEY (provider, cache_key)
      );

      CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];
