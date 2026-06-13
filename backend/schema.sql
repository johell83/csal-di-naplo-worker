-- Családi napló — schéma D1 (Cloudflare SQLite)
-- Base : csaladinaplo-db  ·  uuid 16f97ff9-7ffe-4210-a6f9-1c524bed4284  ·  région EEUR
-- Appliqué le 2026-06-08. Re-jouable (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS recipient (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, nick TEXT, relation TEXT, birth TEXT, nameday TEXT,
  language TEXT DEFAULT 'hu',
  street TEXT, postcode TEXT, city TEXT, country TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS family (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, surname TEXT, code TEXT UNIQUE NOT NULL,
  recipient_id INTEGER REFERENCES recipient(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER REFERENCES family(id),
  name TEXT, email TEXT, role TEXT DEFAULT 'member',   -- manager | payer | member
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscription (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER REFERENCES family(id),
  zone TEXT,            -- hu | eu
  frequency TEXT,       -- havi | ketheti | heti
  currency TEXT,        -- HUF | EUR
  amount INTEGER,
  status TEXT DEFAULT 'pending',   -- pending | active | past_due | canceled
  barion_recurrence_id TEXT,       -- token récurrence (option auto-charge)
  next_charge_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER REFERENCES subscription(id),
  provider TEXT DEFAULT 'barion',
  provider_payment_id TEXT,
  amount INTEGER, currency TEXT,
  status TEXT DEFAULT 'pending',   -- pending | succeeded | failed
  type TEXT DEFAULT 'initial',     -- initial | recurring
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER REFERENCES payment(id),
  szamlazz_number TEXT,            -- n° facture Számlázz
  pdf_url TEXT,                    -- PDF archivé (R2)
  status TEXT DEFAULT 'issued',    -- proforma(díjbekérő) | issued | paid
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER REFERENCES family(id),
  author_user_id INTEGER REFERENCES user(id),
  text TEXT, img_key TEXT,         -- img_key = clé objet R2
  family_only INTEGER DEFAULT 0,   -- 1 = « csak papír »
  meta_date TEXT, meta_time TEXT, meta_place TEXT,  -- EXIF éditable
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES post(id),
  author_user_id INTEGER REFERENCES user(id),
  text TEXT, created_at TEXT DEFAULT (datetime('now'))
);

-- Données de démo (famille Kovács / KOV-7821)
INSERT INTO recipient (name,nick,relation,birth,nameday,language,street,postcode,city,country)
SELECT 'Kovács Józsefné','Mária mama','Édesanya / Nagymama','1948-09-12','Mária — szept. 12.','hu','Kárász utca 14.','6720','Szeged','Magyarország'
WHERE NOT EXISTS (SELECT 1 FROM recipient WHERE name='Kovács Józsefné');
INSERT INTO family (name,surname,code,recipient_id)
SELECT 'Kovács család','Kovács','KOV-7821',(SELECT id FROM recipient WHERE name='Kovács Józsefné')
WHERE NOT EXISTS (SELECT 1 FROM family WHERE code='KOV-7821');
INSERT INTO user (family_id,name,email,role)
SELECT (SELECT id FROM family WHERE code='KOV-7821'),'Kovács Anna','anna@example.com','manager'
WHERE NOT EXISTS (SELECT 1 FROM user WHERE email='anna@example.com');
