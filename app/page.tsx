import Dashboard from "@/components/dashboard";
import { requireChatGPTUser } from "./chatgpt-auth";
import { authConfig } from "@/lib/auth-config";
import { getAppUser } from "@/lib/auth-user";
import { AuthControls } from "@/components/auth-controls";
export const dynamic = "force-dynamic";
export default async function Page() {
  const config=authConfig();
  if(config.mode === "sites") {
    await requireChatGPTUser("/");
    return <Dashboard />;
  }
  const user=await getAppUser();
  if(user) return <Dashboard standalone displayName={user.fullName || user.displayName} />;
  return <main className="stock-login"><div className="stock-login-card">
    <p className="stock-login-brand">↗ Stock Prediction</p>
    <p className="stock-login-kicker">RESEARCH WITH PERSPECTIVE</p>
    <h1>A clearer view<br/>of the market.</h1>
    <p>Explore company data, inspect experimental forecasts, and test ideas with paper trading. Your watchlist, portfolio, and trading history stay in your own account.</p>
    {config.providers.includes("google") ? <>
      <AuthControls action="guest"/>
      <p className="stock-guest-note">Your guest workspace is tied to this browser’s cookies. Signing out or clearing cookies ends access. For the current Google sign-in preview, use an allowed test account.</p>
      <details className="stock-google-preview"><summary>Google sign-in preview</summary><AuthControls action="signin"/></details>
    </> : <p className="stock-auth-error" role="status">Sign-in is being configured. Please check back shortly.</p>}
    <div className="stock-login-notes"><span>Real market data</span><span>Transparent model evaluation</span><span>Private workspace</span></div>
    <p className="stock-login-disclaimer">An experimental research tool. Forecasts are estimates, not investment advice. Paper trading uses simulated money.</p>
  </div></main>;
}
