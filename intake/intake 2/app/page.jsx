"use client";
import dynamic from "next/dynamic";

const IntakeApp = dynamic(() => import("../components/IntakeApp"), { ssr: false });

export default function Page() {
  return <IntakeApp />;
}
