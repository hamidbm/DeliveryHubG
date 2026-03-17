import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { runBootstrap } from "../shared/bootstrap/runBootstrap";

export const metadata: Metadata = {
  title: "DeliveryHub",
  description: "Software Delivery & APM Portal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await runBootstrap();
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
