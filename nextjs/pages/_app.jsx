import React from 'react';
import Head from 'next/head';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>NimbusFlow - Autonomous AutoPay Voice Recovery (Next.js Edition)</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>
      <div className="bg-slate-950 text-slate-100 min-h-screen font-sans">
        <Component {...pageProps} />
      </div>
    </>
  );
}
