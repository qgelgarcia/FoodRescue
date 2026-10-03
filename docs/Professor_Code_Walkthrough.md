# FoodRescue Code Walkthrough

## 1. One-minute explanation

FoodRescue is an Ionic React application inside an npm workspace monorepo. React renders functional components, Ionic supplies mobile-friendly primitives such as `IonApp`, `IonPage`, `IonContent`, `IonHeader`, and `IonCard`, and Tailwind CSS supplies most visual styling through JSX `className` values. Supabase provides authentication, database access, storage, and row-level security. The Express TypeScript app is currently a small backend health/API service.

The main user flow is:

```text
main.jsx
  -> IonApp + IonReactRouter
  -> App.jsx routes
  -> AuthGuard / RoleGuard
  -> HomeFeed, MapPage, PostPage, HistoryPage, ProfilePage
  -> service modules
  -> Supabase or local demo storage
```

## 2. Framework locations

The framework source is installed as a dependency; this repository imports and composes it. Do not edit files inside `node_modules`.

| Framework or library | Declared in | Used in this project | What it does |
|---|---|---|---|
| React | `apps/frontend/package.json` | `main.jsx`, `App.jsx`, every `.jsx` component | Functional components, JSX, state, effects, and props |
| Ionic React | `apps/frontend/package.json` | `main.jsx`, `PageShell.jsx`, `CustomerHeader.jsx`, `FoodCard.jsx` | Mobile UI primitives and Ionic layout behavior |
| React Router | `apps/frontend/package.json` | `App.jsx`, guards, auth/profile pages | URL routing and redirects |
| Tailwind CSS | `styles.css`, `vite.config.js` | Most `.jsx` files | Utility classes such as `flex`, `rounded-3xl`, and `text-sm` |
| Motion | `App.jsx`, `FoodCard.jsx`, page components | `AnimatePresence`, `motion.div`, transitions | Page, modal, and category animations |
| Lucide React | component imports | `FoodCard.jsx`, `MapPage.jsx`, and other screens | React icon components |
| Supabase JS | `services/supabase.js` | `services/auth.js`, `services/food.js` | Authenticated database and RPC calls |
| Express + TypeScript | `apps/backend/package.json` | `apps/backend/src/` | Backend server and `/api/health` response |

Installed implementations are under paths such as `node_modules/@ionic/react/dist/` and `node_modules/react/`. `package-lock.json` records the resolved versions. The application code belongs in `apps/` and `packages/`, not in `node_modules/`.

## 3. Where Ionic Card is implemented and used

`IonCard` is imported from the Ionic React package at the top of `apps/frontend/src/components/FoodCard.jsx`:

```jsx
import { IonCard } from '@ionic/react';
```

It is used as the Ionic card host around the reusable visual card:

```jsx
<IonCard className="food-card-ion">
  <TiltCard ...>
    {/* image, food details, portion controls, and claim button */}
  </TiltCard>
</IonCard>
```

The Ionic implementation is supplied by `node_modules/@ionic/react`, which wraps Ionic Core web components. The project controls its composition and appearance through `food-card-ion` in `apps/frontend/src/styles.css` and the Tailwind classes passed to `TiltCard`.

## 3.1 Ionic component import/use map

These are the Ionic components currently used in application source code:

| Ionic component | Imported in | Used in code | Purpose |
|---|---|---|---|
| `IonApp` | `apps/frontend/src/main.jsx` | `<IonApp>` around the router | Ionic application root |
| `IonReactRouter` | `apps/frontend/src/main.jsx` | `<IonReactRouter>` around `App` | Connects Ionic with React Router |
| `IonPage` | `apps/frontend/src/components/PageShell.jsx` | `<IonPage>` around each user screen | Ionic page lifecycle/layout host |
| `IonContent` | `apps/frontend/src/components/PageShell.jsx` | `<IonContent fullscreen>` inside each page | Scrollable screen content area |
| `IonHeader` | `apps/frontend/src/components/CustomerHeader.jsx` | `<IonHeader>` around the customer header | Ionic header region |
| `IonCard` | `apps/frontend/src/components/FoodCard.jsx` | `<IonCard>` around `TiltCard` | Semantic Ionic card container |
| `IonInput` | `apps/frontend/src/components/HomeFeed.jsx` | Search field | Ionic input event/value wrapper |
| `IonSelect` | `apps/frontend/src/components/PostPage.jsx` | Food category field | Ionic select control |
| `IonSelectOption` | `apps/frontend/src/components/PostPage.jsx` | Options inside `IonSelect` | Select choices |
| `IonButton` | `apps/frontend/src/components/PostPage.jsx`, `MapPage.jsx` | Publish and center-map actions | Ionic button behavior and touch target |

For example, the Ionic button in `PostPage.jsx` is imported with:

```jsx
import { IonButton, IonSelect, IonSelectOption } from '@ionic/react';
```

and rendered as:

```jsx
<IonButton type="submit" expand="block" className="post-submit-ionic">
  Publish Food Drop Live
</IonButton>
```

The component's framework implementation is not copied into this repository. Vite resolves `@ionic/react` to `node_modules/@ionic/react/dist/index.js`; the project code supplies props, children, event handlers, and CSS variables.

The card's internal structure is:

```text
IonCard                         Ionic semantic card container
  TiltCard                      project reusable animated card
    Squircle                    project decorative surface helper
    image and food details      JSX content from FoodCard
    portion stepper              React state: portion
    claim button                 React event: handleClaim
    modal                       React state: isModalOpen
```

Other card-like surfaces are intentionally regular `div` elements styled as cards:

| UI surface | File | How to identify it |
|---|---|---|
| Food listing card | `components/FoodCard.jsx` | `IonCard` plus `TiltCard` |
| Loading skeleton card | `components/HomeFeed.jsx` | `bg-white rounded-[2rem]` and `animate-pulse` |
| Claim history item | `components/HistoryPage.jsx` | `bg-white rounded-3xl p-6` |
| Profile/stat cards | `components/ProfilePage.jsx` | `bg-white rounded-3xl p-6` |
| Posting form/tips cards | `components/PostPage.jsx` | `bg-white rounded-3xl` |
| Admin metric cards | `modules/admin/AdminDashboard.jsx` | `.metric-card` in `styles.css` |

An HTML `div` can be visually card-shaped, but it is not automatically an Ionic card. In this version the main food listing is the explicit Ionic card example; the rest are custom React/Tailwind surfaces.

## 4. What `className` means in React

React uses `className` instead of HTML's `class` attribute because `class` is a JavaScript keyword. The value is still a list of CSS class names:

```jsx
<div className="flex items-center gap-3 rounded-2xl bg-white p-4">
```

This example uses Tailwind utility classes:

- `flex` enables Flexbox.
- `items-center` vertically aligns children.
- `gap-3` adds space between children.
- `rounded-2xl` rounds the corners.
- `bg-white` sets the background.
- `p-4` adds padding.

Conditional classes are ordinary JavaScript expressions:

```jsx
className={`... ${isReady ? 'border-emerald-300' : 'opacity-85'}`}
```

Project-authored CSS classes are in `apps/frontend/src/styles.css`, for example `.auth-card`, `.admin-frame`, `.metric-card`, and `.food-card-ion`. Tailwind classes are generated by the `@tailwindcss/vite` plugin configured in `apps/frontend/vite.config.js`.

## 5. React concepts visible in the code

React here uses functional components rather than class components. There are no React `class Foo extends React.Component` classes in the application.

| Concept | Example | Explanation |
|---|---|---|
| Component | `FoodCard`, `HomeFeed`, `PostPage` | A function that returns JSX |
| Props | `FoodCard({ post, onClaimSuccess })` | Data or callbacks passed by a parent |
| State | `useState` in `FoodCard` and `PostPage` | Values that trigger a re-render when changed |
| Effect | `useEffect` in `HomeFeed`, `MapPage`, `HistoryPage` | Work that runs after rendering, such as loading data or timers |
| Event handler | `handleSubmit`, `handleClaim`, `handleNav` | Function called by click, change, submit, or navigation events |
| List rendering | `filtered.map(...)`, `claims.map(...)` | Converts arrays into repeated JSX with a stable `key` |
| Conditional rendering | `{loading ? ... : ...}` | Selects loading, error, empty, or content states |
| Service module | `services/food.js`, `services/auth.js` | Keeps data operations outside the visual components |
| Guard | `AuthGuard`, `RoleGuard` | Blocks routes before rendering protected screens |

## 5.1 Classes and className table

| Item | Where it is located | What to explain |
|---|---|---|
| React class components | None in this project | The app uses functional components and Hooks, not `class Example extends React.Component` |
| JSX `className` | All `.jsx` files under `apps/frontend/src/` | React's name for the HTML `class` attribute |
| Tailwind utility classes | JSX `className` strings | Classes such as `flex`, `p-4`, `rounded-2xl`, `text-sm`, and `bg-white` control layout and styling |
| Conditional class names | `FoodCard.jsx`, `HistoryPage.jsx`, `HomeFeed.jsx`, `Login.jsx` | Template literals choose classes based on state, for example ready/completed or active/inactive |
| Project CSS classes | `apps/frontend/src/styles.css` | Named classes such as `.auth-card`, `.admin-frame`, `.metric-card`, and `.food-card-ion` are regular CSS selectors |
| Ionic component classes | `@ionic/react` internally | Ionic components are imported React wrappers; their implementation is in `node_modules/@ionic/react/dist/`, not written as project classes |
| Animated UI component classes | `components/ui/calamansi/` | `Dock`, `TiltCard`, `DynamicIsland`, `NumberTicker`, and related files are project components, not React class components |

## 5.2 Function and handler table

| Source location | Function or component | Responsibility |
|---|---|---|
| `apps/frontend/src/main.jsx` | `createRoot(...)` | Mounts the React application and wraps it with Ionic's `IonApp` and `IonReactRouter` |
| `apps/frontend/src/App.jsx` | `UserModuleTabs` | Selects the user screen, tracks the active route, and applies page transitions |
| `apps/frontend/src/App.jsx` | `App` | Declares login, register, user, admin, and redirect routes |
| `apps/frontend/src/components/PageShell.jsx` | `PageShell` | Reusable Ionic `IonPage` and `IonContent` wrapper for user screens |
| `apps/frontend/src/components/HomeFeed.jsx` | `HomeFeed` | Owns feed state, search/category filtering, loading/error/empty states, and card rendering |
| `apps/frontend/src/components/HomeFeed.jsx` | `fetchPosts` | Calls `getFoodPosts` and updates loading, posts, and error state |
| `apps/frontend/src/components/HomeFeed.jsx` | `handleClaimSuccess` | Displays a claim confirmation message after a card reports success |
| `apps/frontend/src/components/FoodCard.jsx` | `CalamansiFoodCard` | Reusable food card component; imported elsewhere under the default name `FoodCard` |
| `apps/frontend/src/components/FoodCard.jsx` | `handleNextPhoto`, `handlePrevPhoto` | Changes the selected image in the details modal |
| `apps/frontend/src/components/FoodCard.jsx` | `handleClaim` | Validates the portion count, calls the food service, and displays success/error feedback |
| `apps/frontend/src/components/MapPage.jsx` | `MapPage` | Renders the CSS campus map and rotates live update content |
| `apps/frontend/src/components/PostPage.jsx` | `PostPage` | Owns the controlled create-post form and publish state |
| `apps/frontend/src/components/PostPage.jsx` | `clearFieldError` | Removes the validation message when a field is edited |
| `apps/frontend/src/components/PostPage.jsx` | `handlePhotoUpload`, `removePhoto` | Validates photo files and manages preview images |
| `apps/frontend/src/components/PostPage.jsx` | `handleSubmit` | Validates the complete form, calls `createFoodPost`, and shows success/error feedback |
| `apps/frontend/src/components/HistoryPage.jsx` | `HistoryPage` | Displays local claim passes and empty state |
| `apps/frontend/src/components/HistoryPage.jsx` | `loadClaims`, `handleComplete` | Loads claims and marks a pickup as completed |
| `apps/frontend/src/components/ProfilePage.jsx` | `ProfilePage` | Displays profile data and calculated impact statistics |
| `apps/frontend/src/components/ProfilePage.jsx` | `handleSignOut` | Calls the auth service and redirects to login |
| `apps/frontend/src/components/CustomerHeader.jsx` | `CustomerHeader` | Shared header, active pickup capsule, and profile navigation |
| `apps/frontend/src/components/CustomerHeader.jsx` | `loadClaims`, `handleMarkPickedUp` | Refreshes the pickup capsule and completes a pickup |
| `apps/frontend/src/components/FloatingBottomDock.jsx` | `FloatingBottomDock` | Renders bottom navigation and pending-claim indicator |
| `apps/frontend/src/components/FloatingBottomDock.jsx` | `handleNav` | Calculates route direction and navigates with React Router |
| `apps/frontend/src/guards/AuthGuard.jsx` | `AuthGuard` | Loads the current profile and redirects unauthenticated users |
| `apps/frontend/src/guards/RoleGuard.jsx` | `RoleGuard` | Allows only the required role, normally `admin`, to enter a route |
| `apps/frontend/src/modules/auth/Login.jsx` | `Login` | Sign-in/sign-up screen component with rate limiting and OAuth handling |
| `apps/frontend/src/modules/auth/Login.jsx` | `checkLockoutState`, `startLockoutCountdown` | Reads and updates the failed-login lockout timer |
| `apps/frontend/src/modules/auth/Login.jsx` | `recordFailedAttempt`, `clearFailedAttempts` | Tracks failed attempts and clears them after successful auth |
| `apps/frontend/src/modules/auth/Login.jsx` | `validateInputs`, `getPasswordStrength` | Validates credentials and calculates password strength |
| `apps/frontend/src/modules/auth/Login.jsx` | `handleSubmit`, `handleGoogleAuth`, `navigateUser`, `fillDemo` | Submits credentials, starts OAuth, redirects by role, and fills demo email values |
| `apps/frontend/src/modules/auth/Register.jsx` | `Register` | Standalone registration screen component |
| `apps/frontend/src/modules/auth/Register.jsx` | `getPasswordStrength`, `handleRegister`, `handleGoogleAuth` | Validates registration, creates an account, and starts Google OAuth |
| `apps/frontend/src/services/auth.js` | `login`, `register` | Calls Supabase Auth or the local demo account path |
| `apps/frontend/src/services/auth.js` | `signInWithGoogle`, `logout` | Starts OAuth and clears the current session |
| `apps/frontend/src/services/auth.js` | `getCurrentProfile`, `onAuthStateChange` | Loads the profile and listens for session changes |
| `apps/frontend/src/services/food.js` | `getFoodPosts` | Fetches active posts or returns demo posts when Supabase is not configured |
| `apps/frontend/src/services/food.js` | `createFoodPost` | Validates quantity and creates a post through Supabase or local demo storage |
| `apps/frontend/src/services/food.js` | `claimFoodPost` | Validates a claim and calls the atomic `claim_food` RPC when configured |
| `apps/frontend/src/services/food.js` | `getActiveClaims`, `completeClaim` | Reads local claim passes and updates pickup status |
| `apps/frontend/src/lib/validation.js` | `validateFoodPostDraft` | Performs whole-form/object validation for a food post |
| `apps/frontend/src/lib/validation.js` | `validateClaimQuantity` | Ensures a claim is positive and within remaining inventory |
| `apps/frontend/src/lib/validation.js` | `readStoredArray` | Safely reads array data from localStorage |
| `apps/backend/src/index.ts` | Express middleware and error handler | Configures CORS, JSON limits, routes, 404 responses, and safe errors |
| `apps/backend/src/routes/health.routes.ts` | `healthRouter.get('/health', ...)` | Returns a typed backend health response |
| `supabase/migrations/` | `handle_new_user` | Creates a safe profile when a Supabase Auth user is created |
| `supabase/migrations/` | `is_admin` | Checks the current database user's admin role for RLS policies |
| `supabase/migrations/` | `prevent_profile_role_escalation` | Prevents non-admin users from changing their role to admin |
| `supabase/migrations/` | `claim_food` | Atomically decrements inventory and inserts a claim after auth/quantity checks |

## 6. Important files to open during a code reading

1. `apps/frontend/src/main.jsx`: starts React, loads Ionic CSS, mounts `IonApp` and `IonReactRouter`.
2. `apps/frontend/src/App.jsx`: defines login, registration, user, and admin routes.
3. `apps/frontend/src/components/PageShell.jsx`: applies `IonPage` and `IonContent` to user screens.
4. `apps/frontend/src/components/HomeFeed.jsx`: loads/filter food posts and renders `FoodCard` repeatedly.
5. `apps/frontend/src/components/FoodCard.jsx`: reusable card, portion state, claim event, and details modal.
6. `apps/frontend/src/components/PostPage.jsx`: controlled form, client-side validation, photo preview, and create operation.
7. `apps/frontend/src/services/food.js`: fetch/create/claim logic and demo fallback storage.
8. `apps/frontend/src/services/auth.js`: login, registration, OAuth, logout, and profile loading.
9. `apps/frontend/src/guards/`: authentication and role-based route protection.
10. `packages/shared/src/index.ts`: shared TypeScript interfaces such as `Profile`, `FoodPost`, `Claim`, and `ApiResponse`.
11. `apps/backend/src/index.ts`: Express middleware, CORS policy, 404 response, and error handler.
12. `supabase/migrations/`: tables, constraints, RLS policies, storage policy, and atomic claim RPC.

## 7. Data flow example: claiming a meal

1. `HomeFeed` gets posts from `getFoodPosts()` and passes one post to `FoodCard` through the `post` prop.
2. The user changes `portion`, which updates local React state.
3. Clicking the claim button calls `handleClaim` in `FoodCard`.
4. `validateClaimQuantity` checks that the requested quantity is positive and does not exceed inventory.
5. `claimFoodPost` calls the Supabase `claim_food` RPC when Supabase is configured; otherwise it uses the local demo path.
6. A claim pass is stored and a `foodrescue:claim_updated` browser event is dispatched.
7. `CustomerHeader` and `HistoryPage` listen for that event and refresh their visible claim data.

## 8. What is implemented versus what still requires a demo

Implemented and checked in code: React routing, auth and role guards, reusable components, Ionic app/page/card primitives, responsive flex/grid layouts, loading and empty feed states, form validation, claim quantity validation, Supabase environment configuration, database constraints/RLS, protected claim RPC, backend health route, and automated validation tests.

Still manual or intentionally prototype-level: testing on a physical Android/iOS device, portrait/landscape visual sign-off, production Supabase credentials, real photo upload to Storage, push/chat messaging, a real map provider, and browser end-to-end testing with real accounts. These should be demonstrated or marked honestly rather than claimed from source code alone.
