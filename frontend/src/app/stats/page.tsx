@@
-              <select 
-                value={selectedStoreId}
-                onChange={(e) => setSelectedStoreId(e.target.value)}
-                className="p-1.5 px-3 rounded-lg text-sm bg-slate-50 border border-slate-200 font-semibold outline-none text-slate-700 focus:border-blue-500 cursor-pointer"
-              >
-                {profile?.stores?.map((store: any) => (
-                  <option key={store.id} value={store.id}>{store.name}</option>
-                ))}
-              </select>
+              <div className="relative z-50">
+                <select 
+                  value={selectedStoreId}
+                  onChange={(e) => setSelectedStoreId(e.target.value)}
+                  className="p-1.5 px-3 rounded-lg text-sm bg-slate-50 border border-slate-200 font-semibold outline-none text-slate-700 focus:border-blue-500 cursor-pointer relative z-50"
+                >
+                  {profile?.stores?.map((store: any) => (
+                    <option key={store.id} value={String(store.id)}>{store.name}</option>
+                  ))}
+                </select>
+              </div>
