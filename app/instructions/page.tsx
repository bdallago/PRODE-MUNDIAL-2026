"use client";

import dynamic from "next/dynamic";

const Instructions = dynamic(() => import("../../src/views/Instructions"), {
  ssr: false,
});

export default function InstructionsPage() {
  return <Instructions />;
}
