'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState<string>('Loading...');

  useEffect(() => {
    // Fetch data from the Rust API (port 8080)
    fetch('http://localhost:8080/')
      .then((res) => res.text())
      .then((data) => setMessage(data))
      .catch((err) => setMessage('Error connecting to API: ' + err.message));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Praxis</h1>
      <p className="text-xl">
        Backend: <span className="font-mono bg-gray-100 p-1 rounded text-black">{message}</span>
      </p>
    </div>
  );
}