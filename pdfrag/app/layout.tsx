import "./globals.css";
import React from "react";
import { Inter } from "next/font/google";


const inter = Inter({ subsets: ["latin"] });


export const metadata = {
title: "Notes Summarizer",
description: "Upload PDFs and chat with your notes",
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en">
<body className={inter.className}>
<div className="max-w-6xl mx-auto p-6">
<header className="flex items-center justify-between mb-6">
<h1 className="text-xl font-semibold">📚 Notes Summarizer</h1>
<div className="text-sm text-muted-foreground">No auth · In-memory chat history</div>
</header>


<main>{children}</main>


<footer className="mt-8 text-center text-sm text-muted-foreground">
Local dev — refresh clears chat history.
</footer>
</div>
</body>
</html>
);
}