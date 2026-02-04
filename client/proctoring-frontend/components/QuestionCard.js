/**
 * QuestionCard
 * 
 * Displays a dummy question with options and AI hint interactors.
 * Layout mimics the provided design.
 */
import React, { useState } from 'react';

export default function QuestionCard() {
    const [selectedOption, setSelectedOption] = useState(null);

    const questionText = "The most unsymmetrical and the most symmetrical crystal systems based on lattice parameters (i.e., unit cell lengths and angles), are respectively represented by the examples";

    const options = [
        { id: 'A', text: 'CuSO4·5H2O, NaCl' },
        { id: 'B', text: 'Rhombic sulphur, NaCl' },
        { id: 'C', text: 'Rhombic sulphur, NaCl' }, // Repeating as per mockup text or similar
        { id: 'D', text: 'Diamond, NaCl' },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 h-full flex flex-col">

            {/* Header / Meta */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Question 1:</h2>
                    <p className="text-gray-600 leading-relaxed text-lg">
                        {questionText}
                    </p>
                </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 mb-8">
                <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">Only one correct answer</span>
                <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">Easy</span>

                <div className="ml-auto flex items-center gap-4 text-xs font-mono">
                    <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100">Your time 9 Sec</span>
                    <span className="bg-gray-50 text-gray-500 px-2 py-1 rounded border border-gray-100">Ideal time 5 Sec</span>
                </div>
            </div>

            {/* Options */}
            <div className="space-y-4 mb-8">
                {options.map((opt) => (
                    <label
                        key={opt.id}
                        className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all hover:bg-gray-50
                            ${selectedOption === opt.id ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500' : 'border-gray-200'}
                        `}
                    >
                        <input
                            type="radio"
                            name="question1"
                            value={opt.id}
                            checked={selectedOption === opt.id}
                            onChange={() => setSelectedOption(opt.id)}
                            className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 mr-4"
                        />
                        <span className="text-gray-700 font-medium text-lg">
                            <span className="text-gray-400 mr-2">{opt.id}.</span> {opt.text}
                        </span>
                    </label>
                ))}
            </div>

            {/* AI Hints Accordion */}
            <div className="mt-auto">
                <div className="border border-gray-200 rounded-lg p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50">
                    <span className="font-semibold text-gray-700 flex items-center gap-2">
                        <span className="text-xl">✨</span> AI Hints will help you solve it much faster
                    </span>
                    <span className="text-gray-400">⌄</span>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-100">
                <button className="px-6 py-2 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 font-medium">
                    &lt; Previous
                </button>
                <button className="px-8 py-2 bg-white border-2 border-blue-400 text-blue-500 rounded-lg hover:bg-blue-50 font-bold">
                    Next &gt;
                </button>
            </div>
        </div>
    );
}
