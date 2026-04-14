"use client";

import dynamic from "next/dynamic";

const Terms = dynamic(() => import("../../src/views/Terms"), {
  ssr: false,
});

export default function TermsPage() {
  return <Terms />;
}
