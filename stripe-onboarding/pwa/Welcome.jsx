import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function WelcomePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [plan, setPlan] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadSubscription() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError("Please sign in to continue.");
          setLoading(false);
          return;
        }

        const { data, error: rpcError } = await supabase.rpc(
          "my_subscription_status"
        );

        if (rpcError) {
          console.error("Failed to load subscription:", rpcError);
          setError("Could not load your subscription details.");
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          setOrgName(data[0].org_name);
          setPlan(data[0].plan);
        } else {
          const orgSlug = searchParams.get("org");
          setOrgName(orgSlug || "your organisation");
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadSubscription();
  }, [searchParams]);

  const handleGetStarted = () => {
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.heading}>Oops</h1>
          <p style={styles.errorText}>{error}</p>
          <button style={styles.button} onClick={() => navigate("/login")}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <span style={styles.icon}>🎳</span>
        </div>
        <h1 style={styles.heading}>Welcome to BowlsTrack!</h1>
        <p style={styles.subheading}>
          <strong>{orgName}</strong> is all set up
          {plan && (
            <span>
              {" "}
              on the <strong>{plan}</strong> plan
            </span>
          )}
          .
        </p>

        <div style={styles.features}>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>📊</span>
            <div>
              <strong>Track Performance</strong>
              <p style={styles.featureDesc}>
                Record scores, analyse trends, and improve your game.
              </p>
            </div>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>👥</span>
            <div>
              <strong>Manage Your Team</strong>
              <p style={styles.featureDesc}>
                Invite members, assign roles, and coordinate matches.
              </p>
            </div>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>🏆</span>
            <div>
              <strong>Competitions</strong>
              <p style={styles.featureDesc}>
                Set up leagues, track standings, and celebrate wins.
              </p>
            </div>
          </div>
        </div>

        <button style={styles.button} onClick={handleGetStarted}>
          Get Started
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a5e1f 0%, #2d8a33 50%, #1a5e1f 100%)",
    padding: "1rem",
  },
  card: {
    background: "white",
    borderRadius: "1rem",
    padding: "2.5rem",
    maxWidth: "480px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  iconWrapper: {
    marginBottom: "1rem",
  },
  icon: {
    fontSize: "3rem",
  },
  heading: {
    fontSize: "1.75rem",
    color: "#1a5e1f",
    marginBottom: "0.5rem",
  },
  subheading: {
    color: "#555",
    fontSize: "1.1rem",
    marginBottom: "2rem",
  },
  features: {
    textAlign: "left",
    marginBottom: "2rem",
  },
  feature: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  featureIcon: {
    fontSize: "1.5rem",
    flexShrink: 0,
  },
  featureDesc: {
    color: "#666",
    fontSize: "0.9rem",
    margin: "0.25rem 0 0 0",
  },
  button: {
    background: "linear-gradient(135deg, #1a5e1f, #2d8a33)",
    color: "white",
    border: "none",
    borderRadius: "0.5rem",
    padding: "0.875rem 2rem",
    fontSize: "1.1rem",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #e0e0e0",
    borderTopColor: "#1a5e1f",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto 1rem",
  },
  loadingText: {
    color: "#555",
    fontSize: "1.1rem",
  },
  errorText: {
    color: "#c0392b",
    fontSize: "1.1rem",
    marginBottom: "1.5rem",
  },
};
