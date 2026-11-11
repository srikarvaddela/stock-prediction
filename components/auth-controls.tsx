"use client";
import { useState } from "react";

export function AuthControls({action}: {action: "signin" | "signout"}) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function run() {
    setBusy(true);setError("");
    try {
      const {createAuthClient} = await import("better-auth/client");
      const client = createAuthClient({baseURL:window.location.origin});
      if(action === "signin") {
        const result = await client.signIn.social({provider:"google",callbackURL:"/"});
        if(result.error) throw new Error("Google sign-in could not start. Please try again.");
      } else {
        const result = await client.signOut();
        if(result.error) throw new Error("Sign-out failed. Please try again.");
        window.location.assign("/");
      }
    } catch(e) {
      setError(e instanceof Error?e.message:"Please try again.");setBusy(false);
    }
  }
  return <><button className={action === "signin"?"stock-google-signin":"stock-signout"} onClick={()=>void run()} disabled={busy} aria-label={action === "signin"?"Sign in with Google":"Sign out"}>{busy?"Please wait…":action === "signin"?<img src="/google-sign-in.png" alt="Sign in with Google"/>:"Sign out"}</button>{error&&<p role="alert" className="stock-auth-error">{error}</p>}</>;
}
