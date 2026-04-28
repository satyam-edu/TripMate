import { useAuth } from '../context/AuthContext';

// Temporary Home placeholder — replace this with the full Trip Feed page later.
export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="home-placeholder">
      <div className="home-card">
        <div className="home-avatar">
          {user?.avatar
            ? <img src={user.avatar} alt={user?.name} />
            : <span>{user?.name?.[0]?.toUpperCase()}</span>}
        </div>
        <h2>Welcome back, {user?.name?.split(' ')[0]}! 👋</h2>
        <p>You're authenticated. The trip feed is coming next.</p>
        <button type="button" className="logout-btn" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
