import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lnsyldupanemvmdjovhi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lsZHVwYW5lbXZtZGpvdmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODE2NTIsImV4cCI6MjA5NDg1NzY1Mn0.bv-Up7sIM1fTh_wLxf9fOqzSSZ4Iy1rDOq6CXh_CdTg'
);

async function testUpdate() {
  console.log("Testing updateTeam on Supabase...");
  // First get a team to test with
  const { data: teams } = await supabase.from('teams').select('id, name').limit(1);
  if (!teams || teams.length === 0) {
    console.log("No teams found");
    return;
  }
  const teamId = teams[0].id;
  console.log(`Testing with team ${teamId} (${teams[0].name})`);
  
  const { data, error } = await supabase
    .from('teams')
    .update({ logo_url: 'test_url' })
    .eq('id', teamId)
    .select()
    .single();
    
  if (error) {
    console.error("Update failed with error:", error.message, error.details);
  } else {
    console.log("Update succeeded! Returned data:", data);
  }
}

testUpdate();
