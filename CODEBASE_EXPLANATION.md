# FoodRescue Codebase Explanation (In-Depth)

This document provides a highly detailed overview of all the major files within the `FoodRescue` project. It includes code snippets to explain exactly how these pieces function, covering everything from the backend server to individual frontend views and security modules.

---

## 1. Backend (`apps/backend/src`)
The backend provides APIs (GET/POST requests) for the frontend to consume.

### `index.ts`
*   **Purpose:** The main entry point and configuration file for your Express server.
*   **How it works:** It sets up the server, configures CORS (Cross-Origin Resource Sharing) for security, parses JSON, and mounts routes.
```typescript
import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.routes.js';

const app = express();

// Security: CORS ensures only your trusted frontend (CLIENT_URL) can make requests to this backend.
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

// Middleware: Automatically parses incoming JSON data in POST requests.
app.use(express.json());

// Routes: Mounts the healthRouter under the '/api' path.
app.use('/api', healthRouter);
```

### `routes/health.routes.ts`
*   **Purpose:** Provides a health check endpoint.
*   **How it works:** It defines a `GET` request endpoint. When a client visits `/api/health`, the server responds with a JSON object.
```typescript
import { Router, Request, Response } from 'express';
export const healthRouter = Router();

// GET Request: Listens for requests at the '/health' endpoint.
healthRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'FoodRescue Backend API is running healthy',
    data: { timestamp: new Date().toISOString() }
  });
});
```

---

## 2. Frontend Routing & Security (`apps/frontend/src`)
The frontend is a React app that handles the user interface and client-side routing.

### `App.jsx`
*   **Purpose:** The central routing component.
*   **How it works:** Uses `react-router-dom` to map URLs to specific UI components. It employs Guard components for conditional security.
```javascript
import { Route, Switch, Redirect } from 'react-router-dom';
import Login from './modules/auth/Login';
import AuthGuard from './guards/AuthGuard';
import UserModuleTabs from './components/UserModuleTabs'; // Handles the main app UI

export default function App() {
  return (
    <Switch>
      <Route exact path="/login" component={Login} />
      
      {/* Protected Route: AuthGuard checks if the user is logged in */}
      <AuthGuard path="/app" component={UserModuleTabs} />
      
      {/* Fallback Condition: If URL doesn't match above, redirect to login */}
      <Redirect to="/login" />
    </Switch>
  );
}
```

### `guards/AuthGuard.jsx`
*   **Purpose:** Protects routes that require a user to be logged in.
*   **How it works:** It fetches the user's profile on mount. If a profile exists, it renders the requested component. If not, it redirects to the login screen.
```javascript
export default function AuthGuard({ component: Component, ...rest }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentProfile().then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <Route
      {...rest}
      render={(props) =>
        // Condition: If profile exists, render Component. Else, Redirect to login.
        profile ? <Component {...props} userProfile={profile} /> : <Redirect to="/login" />
      }
    />
  );
}
```

### `modules/auth/Login.jsx`
*   **Purpose:** Handles user onboarding and authentication.
*   **How it works:** This is a highly complex module that includes state management for forms, Google OAuth integration, client-side input validation, and security rate-limiting.
```javascript
// Rate Limiting Guardrail
function recordFailedAttempt() {
  const currentAttempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10) + 1;
  localStorage.setItem(ATTEMPTS_KEY, currentAttempts.toString());

  // Condition: If user fails 5 times, lock them out for 30 seconds
  if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = Date.now() + (LOCKOUT_DURATION_SECONDS * 1000);
    localStorage.setItem(LOCKOUT_KEY, lockoutUntil.toString());
    startLockoutCountdown(LOCKOUT_DURATION_SECONDS);
  }
}

// Handling Form Submission
async function handleSubmit(e) {
  e.preventDefault();
  
  if (lockoutSeconds > 0) return; // Prevent submission if locked out
  if (!validateInputs()) return; // Client-side validation

  setLoading(true);
  try {
    if (mode === 'signin') {
      // POST Request concept: Send email/password to auth service
      const { profile, error: err } = await login(email, password);
      if (err) recordFailedAttempt();
      else navigateUser(profile);
    } else {
      // Handle account creation logic...
    }
  } finally {
    setLoading(false);
  }
}
```

---

## 3. Frontend Views (`apps/frontend/src/components`)
These pieces build up the specific views the user sees and interacts with. 

### `HomeFeed.jsx`
*   **Purpose:** The main dashboard where users see all available food.
*   **How it works:** It fetches food posts from the backend on load. It includes a search bar and category pills that filter the displayed list of `FoodCard` components using array `.filter()`.
```javascript
export default function HomeFeed({ userProfile }) {
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data on mount (GET request concept)
  useEffect(() => {
    async function fetchPosts() {
      const data = await getFoodPosts();
      setPosts(data);
    }
    fetchPosts();
  }, []);

  // Filter logic based on user input
  const filtered = posts.filter((item) => {
    const matchCat = category === 'All' || item.category === category;
    const matchSearch = !searchQuery || item.food_name.includes(searchQuery);
    return matchCat && matchSearch;
  });

  return (
    <div>
      {/* Search Input */}
      <input onChange={(e) => setSearchQuery(e.target.value)} />
      
      {/* Mapping over filtered results to render FoodCards */}
      <div className="grid">
        {filtered.map((post) => (
          <FoodCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
```

### `MapPage.jsx`
*   **Purpose:** Shows an interactive map of campus food pickups.
*   **How it works:** Uses absolute positioning over a grid background to simulate a map. It includes interactive pins that show hover details. It also features a "Live Updates" widget that cycles through notifications.
```javascript
export default function MapPage({ userProfile }) {
  // Live Updates Widget Logic
  const [updateIdx, setUpdateIdx] = useState(0);
  useEffect(() => {
    const int = setInterval(() => {
      setUpdateIdx(i => (i + 1) % updates.length);
    }, 4000); // Cycles every 4 seconds
    return () => clearInterval(int);
  }, []);

  return (
    <div className="map-container">
      {/* Interactive Map Pin */}
      <div className="absolute top-1/3 left-1/4 group cursor-pointer">
        <div className="pin-icon"><Utensils /></div>
        {/* Tooltip shown on hover via 'group-hover' CSS class */}
        <div className="tooltip hidden group-hover:block">
          <p>Main Library Cafe</p>
        </div>
      </div>
    </div>
  );
}
```

### `PostPage.jsx`
*   **Purpose:** Allows providers (like dining halls) to post surplus food.
*   **How it works:** An elaborate form with state variables for every input (food name, photos, quantity). On submit, it formats the data and triggers a creation service.
```javascript
export default function PostPage({ userProfile }) {
  const [foodName, setFoodName] = useState('');
  const [photos, setPhotos] = useState([]);

  // Handles reading uploaded image files and creating local preview URLs
  const handlePhotoUpload = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).map(file => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...filesArray]);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    // POST request concept: send new food data to backend
    await createFoodPost({ foodName, photoUrl: photos[0], /*...*/ });
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" onChange={(e) => setFoodName(e.target.value)} />
      <input type="file" onChange={handlePhotoUpload} />
      <button type="submit">Publish Food Drop</button>
    </form>
  );
}
```

---

## 4. Reusable UI Components
Components that are used multiple times across different views to maintain visual consistency.

### `FoodCard.jsx`
*   **Purpose:** Displays individual food rescue opportunities.
*   **How it works:** It receives a `post` prop containing the food data. It calculates time remaining and handles conditional styling.
```javascript
export default function FoodCard({ post, onClaimSuccess }) {
  // Logic to determine if food expires soon
  const isUrgent = diffMinutes < 45;

  return (
    <div className="card">
      <h3>{post.food_name}</h3>
      {/* Conditional Styling based on urgency */}
      <span className={isUrgent ? 'bg-rose-100 animate-pulse' : 'bg-emerald-100'}>
        Expires soon!
      </span>
      {/* Claim Button */}
      <button onClick={handleClaim} disabled={post.quantity_remaining <= 0}>
        Claim
      </button>
    </div>
  );
}
```

### `CustomerHeader.jsx` & `FloatingBottomDock.jsx`
*   **Purpose:** Global navigation.
*   **How it works:** `CustomerHeader` listens to global events to show active pickups. `FloatingBottomDock` uses `useHistory` to programmatically navigate the user between `HomeFeed`, `MapPage`, `PostPage`, etc.
