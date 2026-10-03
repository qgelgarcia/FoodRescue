# FoodRescue — Specifications

## 1. Project Summary
A mobile platform (with a web-based admin panel built from the same codebase) that connects students, campus organizations, and food providers to share surplus food that is still safe to eat, reducing waste and improving food access on campus.

**Target users:** Students, campus organizations, food providers, and platform admins.
**Current core stack:** Ionic React, Vite, React Router, Supabase (Postgres, Auth, Storage, RPC), Tailwind CSS, and an Express TypeScript health service. The map is currently a CSS campus prototype; push messaging is out of scope for the current demo.

## 2. Functional Requirements

### 2.1 Authentication & Profiles
- FR-1: Users can register with name, email, password, phone, and role (student/org/provider).
- FR-2: Users can log in/out; sessions persist via Supabase Auth JWT.
- FR-3: Admin accounts are provisioned separately (not self-registrable) or promoted manually via DB/admin panel.
- FR-4: Users can view/edit their own profile (name, phone, avatar).

### 2.2 Food Posting (Donor)
- FR-5: Donor can create a post with food name, description, quantity, optional photo, pickup location, and expiration deadline.
- FR-6: Donor can edit or cancel their own active post.
- FR-7: `quantity_remaining` auto-decrements as claims are accepted/submitted, and the post is marked `fully_claimed` when it reaches 0.
- FR-8: Each post displays a live countdown to `expires_at`.
- FR-9: Posts past their deadline are automatically hidden from the public feed (status flips to `expired`).

### 2.3 Food Claiming
- FR-10: Users can browse active posts, sorted by distance or by soonest deadline.
- FR-11: Users can claim a specific quantity (≤ remaining quantity) of a post.
- FR-12: Claim quantity decrement must be atomic to prevent overselling under concurrent claims.
- FR-13: Each claim has a status: `pending`, `accepted`, `rejected`, `picked_up`, `cancelled`.
- FR-14: Donor can accept/reject pending claims; can mark accepted claims as picked up.
- FR-15: Claimant can cancel a pending claim.

### 2.4 Map & Location
- FR-16: The current prototype collects pickup location/instructions as text and displays a CSS campus map; a real Leaflet/OpenStreetMap picker remains a future implementation.
- FR-17: Feed/detail views display the pickup pin on a map.
- FR-18: Feed can be sorted by distance from the user's current location.

### 2.5 Notifications
- FR-19: Users receive push notifications for: new nearby posts, claim received, claim accepted/rejected, pickup reminders.
- FR-20: In-app notification inbox lists all notifications with read/unread state.

### 2.6 History & Accountability
- FR-21: Donors and claimants can view a log of all past completed/cancelled transactions.

### 2.7 Admin (Web Panel)
- FR-22: Admin can view/search/filter all users, and suspend or ban accounts.
- FR-23: Admin can view/remove any post regardless of owner.
- FR-24: Admin can view and resolve user-submitted reports against posts/users.
- FR-25: Admin can view claim disputes (e.g., repeated no-shows).
- FR-26: Admin can broadcast an announcement notification to all users or a role segment.
- FR-27: All admin actions are recorded in an audit log.
- FR-28: Admin dashboard shows summary metrics (active posts, total redistributed, active users, open reports).

## 3. Non-Functional Requirements
- NFR-1: **Security** — all data access enforced by Postgres Row Level Security, not just client-side checks.
- NFR-2: **Consistency** — quantity claims must never oversell; enforced via atomic RPC functions.
- NFR-3: **Responsiveness** — feed and claims list should reflect changes within seconds via Realtime, not manual refresh.
- NFR-4: **Usability** — mobile UI optimized for one-handed use (bottom tabs, large tap targets); admin UI optimized for desktop (tables, side nav).
- NFR-5: **Performance** — expired-post filtering should not require scanning the full table on every fetch; a scheduled job updates status instead.
- NFR-6: **Availability** — reliant on Supabase's managed uptime; no custom server to maintain.
- NFR-7: **Scalability (reasonable for a student project)** — schema and indexes should support hundreds of concurrent posts/claims without redesign.
- NFR-8: **Auditability** — every admin moderation action is logged with actor, action, target, and timestamp.

## 4. Out of Scope (v1)
- Payments or monetary transactions (this is a free food-sharing platform).
- In-app chat between donor and claimant (contact happens at pickup).
- Multi-language support.
- Native iOS/Android-only features beyond what Capacitor + Ionic provide out of the box.

## 5. Assumptions
- Users are within a single campus/city region (geofencing is not required beyond simple distance sort).
- Food safety judgment (is it actually still edible) is the donor's responsibility, not enforced by the app.
- Admins are a small, trusted group (no need for a granular admin-permission system in v1).
