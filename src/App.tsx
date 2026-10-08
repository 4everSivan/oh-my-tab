import React from 'react';

export const App: React.FC = () => {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="space-y-4 max-w-md">
        <h1 className="text-4xl font-light tracking-tight">oh-my-tab</h1>
        <p className="text-sm opacity-60">Chrome 新标签页工作台工程基础就绪</p>
      </div>
    </main>
  );
};

export default App;
