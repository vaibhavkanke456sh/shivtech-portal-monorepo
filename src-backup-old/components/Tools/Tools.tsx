import React from 'react';

const Tools: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <h2 className="text-2xl font-semibold mb-6">Tools</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="https://aaplesarkar.mahaonline.gov.in/"
          target="_blank"
          rel="noreferrer"
          className="p-4 border rounded-lg bg-white hover:shadow transition"
        >
          <div className="font-medium">Aaple Sarkar - Maharashtra</div>
          <div className="text-sm text-gray-600">aaplesarkar.mahaonline.gov.in</div>
        </a>
      </div>
    </div>
  );
};

export default Tools;


