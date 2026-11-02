import { getCurrentUser } from "@/lib/server-auth";
import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { ProblemSolution } from "@/components/landing/problem-solution";
import { Capabilities } from "@/components/landing/capabilities";
import { Workflow } from "@/components/landing/workflow";
import { TrustEvidence } from "@/components/landing/trust-evidence";
import { Footer } from "@/components/landing/footer";

export const instant = false;

export default async function Home() {
  const user = await getCurrentUser();
  const isAuthenticated = Boolean(user);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/25 selection:text-foreground">
      <Header isAuthenticated={isAuthenticated} />
      <main className="flex-1">
        <Hero />
        <ProblemSolution />
        <Capabilities />
        <Workflow />
        <TrustEvidence />
      </main>
      <Footer />
    </div>
  );
}
