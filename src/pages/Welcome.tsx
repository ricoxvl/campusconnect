import { Link } from "react-router-dom";
export default function Welcome() {
  return (
    <>
      <div className="welcome-content">
        <p className="eyebrow">A BETTER WAY TO START AT UT DALLAS</p>
        <h1>Find your place on campus.</h1>
        <p className="intro">
          Discover three campus experiences that fit your interests, your
          schedule, and where you want to begin.
        </p>
        <span className="audience-chip">
          Made for new and transfer students
        </span>
        <section className="how-it-works" aria-labelledby="how-heading">
          <h2 id="how-heading" className="section-label">
            HOW IT WORKS
          </h2>
          <ol>
            {[
              ["Pick your interests", "Start with the topics you care about."],
              [
                "Tell us when you’re free",
                "Match opportunities to your availability.",
              ],
              [
                "Get your personal Top 3",
                "Explore recommendations and take the next step.",
              ],
            ].map(([title, description], i) => (
              <li key={title}>
                <span className="step-number">0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="note">
          <strong>No account required</strong>
          <p>
            Your preferences stay in this browser. Fictional examples are
            labeled. Confirm current event details with official sources.
          </p>
        </div>
      </div>
      <div className="onboarding-footer welcome-footer">
        <Link className="button primary" to="/onboarding/interests">
          Find my first 3 <span aria-hidden="true">→</span>
        </Link>
        <Link className="button secondary compact" to="/explore">
          Explore events instead
        </Link>
        <p>Independent student project · Not affiliated with UT Dallas</p>
      </div>
    </>
  );
}
