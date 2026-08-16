import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lnsyldupanemvmdjovhi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lsZHVwYW5lbXZtZGpvdmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODE2NTIsImV4cCI6MjA5NDg1NzY1Mn0.bv-Up7sIM1fTh_wLxf9fOqzSSZ4Iy1rDOq6CXh_CdTg'
);

async function testBucket() {
  console.log("Fetching buckets...");
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("Error fetching buckets:", error);
  } else {
    console.log("Buckets:", data.map(b => b.name));
  }
}

testBucket();
