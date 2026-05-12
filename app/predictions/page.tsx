"use client";

import dynamic from "next/dynamic";
import { useAppContext } from "../../src/components/Providers";

const Predictions = dynamic(() => import("../../src/views/Predictions"), {
  ssr: false,
});

export default function PredictionsPage() {
  const { user, loading } = useAppContext();

  if (loading) return null;
  if (!user) return null;

  return <Predictions user={user} />;
}
