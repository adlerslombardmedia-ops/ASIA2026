import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lnsyldupanemvmdjovhi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lsZHVwYW5lbXZtZGpvdmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODE2NTIsImV4cCI6MjA5NDg1NzY1Mn0.bv-Up7sIM1fTh_wLxf9fOqzSSZ4Iy1rDOq6CXh_CdTg'
);

async function test() {
  console.log("Fetching one row from group_assignments...");
  const { data, error } = await supabase
    .from('group_assignments')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching group_assignments:", error);
  } else {
    console.log("Successfully fetched row data:", data);
  }

  console.log("Testing insert with position_in_group...");
  const t1 = await supabase
    .from('group_assignments')
    .upsert({ team_id: 'kta_paris', group_letter: 'A', position_in_group: 0 });
  console.log("t1 response:", t1.error ? t1.error.message : "Success!");

  console.log("Testing insert with sort_order...");
  const t2 = await supabase
    .from('group_assignments')
    .upsert({ team_id: 'kta_paris', group_letter: 'A', sort_order: 0 });
  console.log("t2 response:", t2.error ? t2.error.message : "Success!");
}

test();
