'use client';

import { useState } from 'react';

export default function EarningsCalculator() {
  const [hours, setHours] = useState(40);
  const [experience, setExperience] = useState('some');

  const rateMap: Record<string, number> = {
    beginner: 30,
    some: 45,
    experienced: 55,
    roofing: 70,
  };

  const base = hours * (rateMap[experience] || 45) * 52;
  const low = Math.round((base * 0.8) / 1000) * 1000;
  const high = Math.round((base * 1.2) / 1000) * 1000;

  return (
    <section id="calculator" className="py-20 bg-[#1a1a1a] text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold">
            Calculate Your <span className="text-brand-green">Potential Income</span>
          </h2>
          <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-300">
            See what&apos;s possible when you&apos;re in control of your own success.
          </p>
        </div>

        <div className="max-w-2xl mx-auto bg-gray-900 border-2 border-brand-green rounded-lg p-8">
          {/* Hours slider */}
          <div className="mb-10">
            <label className="block text-2xl font-bold mb-6">
              How many hours can you work per week?
            </label>
            <input
              type="range"
              min={10}
              max={60}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full h-2.5 rounded-full bg-gray-700 appearance-none cursor-pointer accent-brand-green"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-2">
              {[10, 20, 30, 40, 50, 60].map((v) => (
                <span key={v}>{v} hrs</span>
              ))}
            </div>
            <p className="mt-4 text-center text-xl">
              You selected: <span className="font-bold text-brand-green">{hours}</span> hours per week
            </p>
          </div>

          {/* Experience select */}
          <div className="mb-10">
            <label className="block text-2xl font-bold mb-6">
              What&apos;s your experience level?
            </label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full p-4 bg-gray-800 border border-gray-700 rounded text-white"
            >
              <option value="beginner">Beginner (No Sales Experience)</option>
              <option value="some">Some Sales Experience</option>
              <option value="experienced">Experienced in Sales</option>
              <option value="roofing">Experienced in Roofing Sales</option>
            </select>
          </div>

          {/* Result */}
          <div className="mb-10">
            <h3 className="text-2xl font-bold mb-6">Your Estimated Annual Business Revenue</h3>
            <div className="bg-gray-800 p-8 rounded-lg text-center border-2 border-brand-green">
              <p className="text-lg mb-2">Based on your selections, you could earn approximately:</p>
              <p className="text-5xl font-bold my-6 text-brand-green">
                ${low.toLocaleString()} – ${high.toLocaleString()}
              </p>
              <p className="text-sm italic text-gray-400">
                Individual results vary based on performance, market conditions, and other factors.
              </p>
            </div>
          </div>

          <a
            href="#application"
            className="block w-full py-4 text-xl text-center font-semibold bg-brand-green text-black rounded hover:brightness-110 transition"
          >
            Apply Now &amp; Start Building Your Business
          </a>
        </div>
      </div>
    </section>
  );
}
