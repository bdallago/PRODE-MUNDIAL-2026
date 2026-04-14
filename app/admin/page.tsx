"use client";

import dynamic from "next/dynamic";

const Admin = dynamic(() => import("../../src/views/Admin"), {
  ssr: false,
});

export default function AdminPage() {
  return <Admin />;
}
