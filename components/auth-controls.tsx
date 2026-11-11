"use client";
import { useState } from "react";

export function AuthControls({action}: {action: "signin" | "signout" | "guest"}) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function run() {
    setBusy(true);setError("");
    try {
      const {createAuthClient} = await import("better-auth/client");
      const {anonymousClient} = await import("better-auth/client/plugins");
      const client = createAuthClient({baseURL:window.location.origin, plugins:[anonymousClient()]});
      if(action === "guest") {
        const result=await client.signIn.anonymous();
        if(result.error) throw new Error("A guest workspace could not start. Please try again shortly.");
        window.location.assign("/");
      } else if(action === "signin") {
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
  return <><button className={action === "guest"?"stock-guest-signin":action === "signin"?"stock-google-signin":"stock-signout"} onClick={()=>void run()} disabled={busy} aria-label={action === "guest"?"Try a private guest workspace":action === "signin"?"Sign in with Google":"Sign out"}>{busy?"Please wait…":action === "guest"?"Try a private guest workspace →":action === "signin"?<img src="/google-sign-in.png" alt="Sign in with Google"/>:"Sign out"}</button>{error&&<p role="alert" className="stock-auth-error">{error}</p>}</>;
}
