# 📋 Project Plan: Diarva

## Phase 1: Project Setup
- [x] Define folder structure (`models`, `controllers`, `routes`, `services`, `middlewares`, `utils`, `config`, `compliance`)
- [x] Setup **logger** (`winston`) and **error handler middleware**
- [x] Setup **MongoDB connection** (`/config/db.js`)
- [x] Initialize **Express app** (`app.js`, `server.js`)
- [x] Configure **environment variables** (`.env` → PORT, MONGO_URI, JWT_SECRET, NODE_ENV, etc.)
- [x] Setup **linting & formatting** (ESLint, Prettier)

---

## Phase 2: Core Models & Validation
- [x] Implement **User model** (with indexes & validations)
- [x] Implement **Clinic model**
- [x] Implement **AssistantProfile model**
- [x] Implement **Task model**
- [x] Implement **Application model**
- [x] Implement **WorkHistory model**
- [ ] Add **Mongoose middlewares/hooks** (timestamps, pre-save, validation)
- [ ] Add **custom error classes** (`ValidationError`, `AuthError`, `NotFoundError`)

---

## Phase 3: Authentication & Authorization
- [ ] Setup **JWT auth** with access & refresh tokens
- [ ] Implement **role-based access control (RBAC)** (`admin`, `clinic`, `assistant`)
- [ ] Implement **password hashing** (bcrypt)
- [ ] Add **login attempt throttling & lockout**
- [ ] Setup **email verification & password reset** flow
- [ ] Add **multi-factor authentication (MFA)** for admins

---

## Phase 4: Routes & Controllers
- [ ] `userRoutes.js` → signup, login, profile, consent
- [ ] `clinicRoutes.js` → create/update clinic, license verification
- [ ] `assistantRoutes.js` → profile setup, availability, background checks
- [ ] `taskRoutes.js` → create tasks, assign, track status
- [ ] `applicationRoutes.js` → apply, withdraw, review
- [ ] `workHistoryRoutes.js` → track completed jobs, disputes, payments
- [ ] Apply **validation middleware** (`Joi` / `express-validator`)

---

## Phase 5: Services Layer (Business Logic)
- [ ] User service → auth, preferences, consent handling
- [ ] Clinic service → verification, ratings, scheduling
- [ ] Assistant service → matching, performance tracking
- [ ] Task service → scheduling, matching, notifications
- [ ] Application service → scoring & auto-matching
- [ ] Work history service → payments, reviews, disputes

---

## Phase 6: Compliance & Security
- [ ] **Audit Trail** system (log data access & changes)
- [ ] **Consent tracking** (per user, per channel, CASL/PIPEDA compliant)
- [ ] **Data encryption** (field-level, at rest, in transit)
- [ ] **RBAC enforcement** across routes
- [ ] **Data retention policies** (auto-delete expired data)

---

## Phase 7: Notifications System
- [ ] Setup **notification service** (Email, SMS, WhatsApp, Push)
- [ ] Implement **CASL-compliant opt-in/out** per channel
- [ ] Add **fallback channels** (if SMS fails, send Email, etc.)
- [ ] Add **delivery tracking** (sent, delivered, read, failed)

---

## Phase 8: Payment Integration
- [ ] Integrate **Stripe (Canada)** with Interac e-Transfer support
- [ ] Setup **PCI DSS compliance** for payment data
- [ ] Implement **split billing** (insurance vs. patient responsibility)
- [ ] Store **payment confirmations** in work history

---

## Phase 9: Real-Time Features
- [ ] Setup **Socket.io** for task notifications & live chat
- [ ] Scale real-time layer with **Redis pub/sub**
- [ ] Add **presence tracking** (who’s online/available)

---

## Phase 10: Testing & QA
- [ ] Unit tests (Jest)
- [ ] Integration tests (Supertest)
- [ ] End-to-end tests (Cypress)
- [ ] Compliance-specific test cases (consent, audit, notifications)

---

## Phase 11: Deployment & Monitoring
- [ ] Dockerize backend
- [ ] Setup **Kubernetes / Fly.io** deployment
- [ ] Canadian data residency (AWS Canada Central / Azure Canada East)
- [ ] Setup **Prometheus + Grafana** for monitoring
- [ ] Setup **logging pipeline** (ELK stack / CloudWatch)
- [ ] CI/CD pipeline with GitHub Actions