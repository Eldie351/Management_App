@@
   async getSalesSeries(period: 'week' | 'month' | 'year', startISO: string, endISO: string) {
     const start = new Date(startISO);
     const end = new Date(endISO);

-    // For Postgres we use date_trunc to bucket: day for week/month views, month for year view
-    const bucket = (period === 'year') ? 'month' : 'day';
-    const dateFormat = bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';
-
-    // Validate bucket to avoid SQL injection (controlled values only)
-    if (!['day', 'month'].includes(bucket)) throw new Error('Invalid bucket');
-
-    const sql = `SELECT to_char(date_trunc('${bucket}', "createdAt"), '${dateFormat}') as bucket, COALESCE(SUM(amount),0)::numeric as amount
-      FROM "Sale"
-      WHERE "createdAt" BETWEEN $1 AND $2
-      GROUP BY bucket
-      ORDER BY bucket ASC`;
-
-    // Use $queryRawUnsafe with parameterized start/end
-    // start and end are Date objects and will be parameterized
-    const rows: any[] = await this.prisma.$queryRawUnsafe(sql, start, end);
-
-    return rows.map(r => ({ date: r.bucket, amount: Number(r.amount) }));
+    // For Postgres we use date_trunc to bucket: day for week/month views, month for year view
+    if (period === 'year') {
+      // bucket by month
+      const rows: any[] = await this.prisma.$queryRaw`
+        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as bucket, COALESCE(SUM(amount),0)::numeric as amount
+        FROM "Sale"
+        WHERE "createdAt" BETWEEN ${start} AND ${end}
+        GROUP BY bucket
+        ORDER BY bucket ASC
+      `;
+      return rows.map(r => ({ date: r.bucket, amount: Number(r.amount) }));
+    } else {
+      // bucket by day
+      const rows: any[] = await this.prisma.$queryRaw`
+        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as bucket, COALESCE(SUM(amount),0)::numeric as amount
+        FROM "Sale"
+        WHERE "createdAt" BETWEEN ${start} AND ${end}
+        GROUP BY bucket
+        ORDER BY bucket ASC
+      `;
+      return rows.map(r => ({ date: r.bucket, amount: Number(r.amount) }));
+    }
   }
