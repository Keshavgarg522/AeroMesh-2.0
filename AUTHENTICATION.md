# AeroMesh Real Authentication & Role-Based Access Control (RBAC)

AeroMesh features a production-grade, cryptographically secure authentication and authorization system built with FastAPI, PostgreSQL/SQLite, SQLAlchemy, Alembic, and bcrypt.

---

## 1. User Types & Roles

AeroMesh strictly separates users into two distinct tiers:

| Tier | Role Claim | Description | Permissions |
| :--- | :--- | :--- | :--- |
| **General User** | `GENERAL_USER` | Public users, pilots, and geospatial analysts | Create & process drone incidents, view own analysis history, view own profile. Strictly isolated from other users' private data. |
| **Authorized Rescuer** | `AUTHORIZED_RESCUER`<br>`FIRE_RESCUER`<br>`POLICE_RESCUER`<br>`SEARCH_RESCUE`<br>`DISASTER_RESPONSE`<br>`EMERGENCY_OPERATOR` | Verified first responders (firefighters, tactical police, SAR, disaster response teams) | Full incident reconnaissance, tactical responder dispatch, emergency survey protocols, responder badge identification. |

> **Security Rule:** Backend strictly determines roles from verified database records. Never trusts role claims from the client. General users cannot self-register as rescuers.

---

## 2. Authentication Flow

### A. General User Signup (`POST /api/auth/register` or `/auth/register`)
- Input: `Full Name`, `Email`, `Password` (minimum 8 characters).
- Enforces duplicate email prevention and email structure verification.
- Passwords hashed using `bcrypt` (12 rounds with unique salt).
- Automatically assigns `GENERAL_USER` role with `is_active = True`.
- Returns signed JWT bearer access token and serialized user profile.

### B. General User Login (`POST /api/auth/login` or `/auth/login`)
- Input: `Email`, `Password`.
- Verifies hashed password with timing-attack-safe comparison.
- Rejects inactive accounts with `403 Forbidden`.
- Safe error message: `"Invalid email or password."`
- Returns signed JWT bearer access token.

### C. Authorized Rescuer Login (`POST /api/auth/rescuer/login` or `/auth/rescuer/login`)
- Input: `Rescuer ID` (e.g. `FIRE-001`), `Password`.
- Looks up pre-provisioned responder in `authorized_rescuers` table.
- Rejects inactive responders with: `"This authorized responder account is currently inactive."`
- Verifies password hash.
- Issues verified JWT token with responder claims (`role`, `user_type="rescuer"`).
- Directs user to the **Tactical Responder Console** on AeroMesh Dashboard.

---

## 3. Pre-Provisioned Rescuer Management

Rescuer accounts cannot be registered publicly. They must be pre-provisioned by administration using the provisioning tool.

### Provisioning via Script (`backend/scripts/seed_rescuers.py`)

#### Seed Default Testing Rescuers:
```bash
python backend/scripts/seed_rescuers.py
```

This provisions the following test accounts:
| Rescuer ID | Name | Organization | Role | Default Password | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FIRE-001` | Captain Marcus Vance | Fire & Rescue Department | `FIRE_RESCUER` | `Rescuer@AeroMesh2026!` | Active |
| `POLICE-001` | Lieutenant Sarah Jenkins | Metropolitan Police Tactical Unit | `POLICE_RESCUER` | `Rescuer@AeroMesh2026!` | Active |
| `SAR-001` | Officer David Chen | National Search & Rescue Force | `SEARCH_RESCUE` | `Rescuer@AeroMesh2026!` | Active |
| `DISASTER-001` | Director Elena Rostova | Emergency Disaster Management Agency | `DISASTER_RESPONSE` | `Rescuer@AeroMesh2026!` | Active |
| `INACTIVE-001` | Officer Thomas Ray | Fire & Rescue Department | `FIRE_RESCUER` | `Rescuer@AeroMesh2026!` | Inactive (403 Test) |

#### Provision a Custom Rescuer:
```bash
python backend/scripts/seed_rescuers.py \
  --rescuer-id "FIRE-002" \
  --name "Commander Alex Mercer" \
  --password "SecureSecretPass2026!" \
  --org "Fire & Rescue Department" \
  --dept "Engine Company 5" \
  --designation "Battalion Chief" \
  --role "FIRE_RESCUER"
```

---

## 4. Database Schema & Alembic Migrations

### Database Models

#### `users` Table:
- `id` (String(36), Primary Key)
- `name` (String(255), Not Null)
- `email` (String(255), Unique Index, Not Null)
- `password_hash` (String(255), Nullable for OAuth)
- `role` (String(64), Default `'GENERAL_USER'`)
- `is_active` (Boolean, Default `True`)
- `created_at` (DateTime with UTC timezone)
- `updated_at` (DateTime with UTC timezone)
- `last_login` (DateTime with UTC timezone)
- `google_id` (String(128), Optional)
- `profile_image` (String(1024), Optional)

#### `authorized_rescuers` Table:
- `id` (String(36), Primary Key)
- `rescuer_id` (String(64), Unique Index, Not Null)
- `name` (String(255), Not Null)
- `organization` (String(255), Not Null)
- `department` (String(255), Not Null)
- `designation` (String(255), Not Null)
- `password_hash` (String(255), Not Null)
- `role` (String(64), Default `'AUTHORIZED_RESCUER'`)
- `is_active` (Boolean, Default `True`)
- `created_at` (DateTime with UTC timezone)
- `updated_at` (DateTime with UTC timezone)
- `last_login` (DateTime with UTC timezone)

### Running Migrations
```bash
alembic upgrade head
```

---

## 5. API Endpoints Reference

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new general user account |
| `POST` | `/api/auth/login` | Public | General user email/password login |
| `POST` | `/api/auth/rescuer/login` | Public | Rescuer ID/password login |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user/rescuer profile |
| `POST` | `/api/auth/logout` | Authenticated | Explicit session logout confirmation |
| `GET` | `/api/auth/rescuers/roster` | Rescuer Only | Active responder roster (General users get 403) |
| `POST` | `/api/incidents/{id}/tactical-dispatch` | Rescuer Only | Dispatch tactical drone unit (General users get 403) |
| `GET` | `/api/incidents` | Authenticated | List incidents (Strict user data isolation applied) |
| `GET` | `/api/incidents/{id}` | Authenticated | Retrieve incident (General users can only see own) |

---

## 6. Environment Variables (`.env`)

Configure the following environment variables in `backend/.env`:

```env
# Database connection string (PostgreSQL in production, SQLite in local dev)
DATABASE_URL=sqlite:///./aeromesh.db

# Cryptographic secret for signing JWT access tokens
SECRET_KEY=change-this-in-production-to-a-secure-random-32-byte-secret

# Token expiry in minutes (1440 = 24 hours)
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Allowed CORS origins
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174

# Development seed password for test rescuer accounts
TEST_RESCUER_PASSWORD=Rescuer@AeroMesh2026!
```

---

## 7. Frontend Route Protection

The frontend uses React Router and `ProtectedRoute` component:
- `/dashboard`, `/new-analysis`, `/history`, `/profile`, `/report`: Protected. Unauthenticated visitors are redirected to `/login`.
- Session persists on browser refresh via `/api/auth/me` verification.
- Real role is displayed in the Navbar badge and Profile card:
  - General Users see standard profile and analysis tools.
  - Authorized Rescuers see the glowing **Authorized Responder** badge, deploying agency, and the interactive **Tactical Responder Console** with live dispatch capabilities.
