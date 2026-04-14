"use client";

import dynamic from "next/dynamic";

const Privacy = dynamic(() => import("../../src/views/Privacy"), {
  ssr: false,
});

export default function PrivacyPage() {
  return <Privacy />;
}
