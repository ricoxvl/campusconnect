import { Link, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import Welcome from "./pages/Welcome";
import { Interests, Availability } from "./pages/Onboarding";
import Recommendations from "./pages/Recommendations";
import Explore from "./pages/Explore";
import EventDetails from "./pages/EventDetails";
import Plan from "./pages/Plan";
import Admin from "./pages/Admin";
import { EmptyState } from "./components/ui";
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Welcome />} />
        <Route path="onboarding/interests" element={<Interests />} />
        <Route path="onboarding/availability" element={<Availability />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="explore" element={<Explore />} />
        <Route path="events/:id" element={<EventDetails />} />
        <Route path="plan" element={<Plan />} />
        <Route path="admin" element={<Admin />} />
        <Route
          path="*"
          element={
            <EmptyState
              title="Page not found"
              action={
                <Link className="button primary" to="/">
                  Go home →
                </Link>
              }
            >
              Find your way back to CampusConnect.
            </EmptyState>
          }
        />
      </Route>
    </Routes>
  );
}
