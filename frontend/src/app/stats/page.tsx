'use client';

import React, { useState } from 'react';

export default function Page() {
  // local state for the selected store id to avoid ReferenceError
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  // `profile` should come from your auth/context; leave undefined here to avoid runtime crash if not provided.
  const profile: any = undefined;

  return (
    <div className="relative z-50">
      <select
        value={selectedStoreId}
        onChange={(e) => setSelectedStoreId(e.target.value)}
        className="p-1.5 px-3 rounded-lg text-sm bg-slate-50 border border-slate-200 font-semibold outline-none text-slate-700 focus:border-blue-500 cursor-pointer relative z-50"
      >
        {profile?.stores?.map((store: any) => (
          <option key={store.id} value={String(store.id)}>{store.name}</option>
        ))}
      </select>
    </div>
  );
}
