import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegistrationWithLocation {
  id: string;
  student_name: string;
  school_id: string;
  car_type: string;
  status: string;
  parent_accounts: {
    parent_name: string;
    pickup_latitude: number;
    pickup_longitude: number;
    city: string;
  };
  schools: {
    name: string;
    latitude: number;
    longitude: number;
  };
}

interface Route {
  id: string;
  name: string;
  school_id: string;
  car_type: string;
  max_seats: number;
  assignments: { registration_id: string; pickup_order: number }[];
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Cluster students by proximity
function clusterStudents(
  students: RegistrationWithLocation[],
  maxPerCluster: number
): RegistrationWithLocation[][] {
  const clusters: RegistrationWithLocation[][] = [];
  const assigned = new Set<string>();

  for (const student of students) {
    if (assigned.has(student.id)) continue;

    const cluster: RegistrationWithLocation[] = [student];
    assigned.add(student.id);

    // Find nearby students
    const nearby = students
      .filter(s => !assigned.has(s.id))
      .map(s => ({
        student: s,
        distance: calculateDistance(
          student.parent_accounts.pickup_latitude,
          student.parent_accounts.pickup_longitude,
          s.parent_accounts.pickup_latitude,
          s.parent_accounts.pickup_longitude
        )
      }))
      .sort((a, b) => a.distance - b.distance);

    for (const { student: nearbyStudent } of nearby) {
      if (cluster.length >= maxPerCluster) break;
      cluster.push(nearbyStudent);
      assigned.add(nearbyStudent.id);
    }

    clusters.push(cluster);
  }

  return clusters;
}

// Optimize pickup order using nearest neighbor algorithm
function optimizePickupOrder(
  students: RegistrationWithLocation[],
  schoolLat: number,
  schoolLng: number
): RegistrationWithLocation[] {
  if (students.length <= 1) return students;

  const ordered: RegistrationWithLocation[] = [];
  const remaining = [...students];

  // Start from the student furthest from school
  remaining.sort((a, b) => {
    const distA = calculateDistance(schoolLat, schoolLng, a.parent_accounts.pickup_latitude, a.parent_accounts.pickup_longitude);
    const distB = calculateDistance(schoolLat, schoolLng, b.parent_accounts.pickup_latitude, b.parent_accounts.pickup_longitude);
    return distB - distA;
  });

  ordered.push(remaining.shift()!);

  // Use nearest neighbor to order remaining
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistance(
        last.parent_accounts.pickup_latitude,
        last.parent_accounts.pickup_longitude,
        remaining[i].parent_accounts.pickup_latitude,
        remaining[i].parent_accounts.pickup_longitude
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    ordered.push(remaining.splice(nearestIdx, 1)[0]);
  }

  return ordered;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body ONCE - it can only be consumed once
    const body = await req.json();
    const { action, schoolId, carType, maxSeatsPerRoute, routeId, suggestion, driverId, supervisorId, searchArea } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === "suggest-routes") {
      // Get all registrations for the school (pending_fees and complete, not cancelled)
      const { data: registrations, error: regError } = await supabase
        .from("registrations")
        .select(`
          id,
          student_name,
          school_id,
          car_type,
          status,
          parent_accounts (
            parent_name,
            pickup_latitude,
            pickup_longitude,
            city
          ),
          schools (
            name,
            latitude,
            longitude
          )
        `)
        .eq("school_id", schoolId)
        .eq("car_type", carType)
        .neq("status", "cancelled");

      if (regError) throw regError;

      // Filter out already assigned registrations
      const { data: assignments } = await supabase
        .from("route_assignments")
        .select("registration_id");
      
      const assignedIds = new Set((assignments || []).map(a => a.registration_id));
      let unassigned = (registrations || []).filter(r => !assignedIds.has(r.id));

      // If search area is provided, filter students by geographic location
      if (searchArea && searchArea.centerLat && searchArea.centerLng && searchArea.radiusKm) {
        unassigned = unassigned.filter((r: any) => {
          const pa = Array.isArray(r.parent_accounts) ? r.parent_accounts[0] : r.parent_accounts;
          if (!pa || !pa.pickup_latitude || !pa.pickup_longitude) return false;
          
          const distance = calculateDistance(
            searchArea.centerLat,
            searchArea.centerLng,
            pa.pickup_latitude,
            pa.pickup_longitude
          );
          return distance <= searchArea.radiusKm;
        });
      }

      // Check existing routes that have available capacity
      const { data: existingRoutes, error: routesError } = await supabase
        .from("routes")
        .select(`
          id,
          name,
          school_id,
          car_type,
          max_seats,
          is_active,
          route_assignments (
            id,
            registration_id,
            pickup_order
          )
        `)
        .eq("school_id", schoolId)
        .eq("car_type", carType)
        .eq("is_active", true);

      if (routesError) throw routesError;

      // Find routes with available capacity and suggest students to add
      const routeUpdates: any[] = [];
      const studentsToAssign = new Set<string>();

      if (existingRoutes && unassigned.length > 0) {
        // Transform unassigned data
        const formattedUnassigned: RegistrationWithLocation[] = unassigned.map((r: any) => ({
          id: r.id,
          student_name: r.student_name,
          school_id: r.school_id,
          car_type: r.car_type,
          status: r.status,
          parent_accounts: Array.isArray(r.parent_accounts) ? r.parent_accounts[0] : r.parent_accounts,
          schools: Array.isArray(r.schools) ? r.schools[0] : r.schools,
        }));

        for (const route of existingRoutes) {
          const currentCount = route.route_assignments?.length || 0;
          const availableSeats = route.max_seats - currentCount;

          if (availableSeats > 0) {
            // Get the existing assigned students' locations to find nearby unassigned students
            const { data: existingAssignments } = await supabase
              .from("route_assignments")
              .select(`
                registration_id,
                registrations (
                  parent_accounts (
                    pickup_latitude,
                    pickup_longitude
                  )
                )
              `)
              .eq("route_id", route.id);

            // Calculate centroid of existing pickup points
            let centroidLat = 0, centroidLng = 0;
            if (existingAssignments && existingAssignments.length > 0) {
              const locs = existingAssignments.map((a: any) => {
                const pa = Array.isArray(a.registrations?.parent_accounts) 
                  ? a.registrations.parent_accounts[0] 
                  : a.registrations?.parent_accounts;
                return pa;
              }).filter(Boolean);

              if (locs.length > 0) {
                centroidLat = locs.reduce((sum: number, l: any) => sum + (l.pickup_latitude || 0), 0) / locs.length;
                centroidLng = locs.reduce((sum: number, l: any) => sum + (l.pickup_longitude || 0), 0) / locs.length;
              }
            }

            // Find nearby unassigned students
            const nearbyStudents = formattedUnassigned
              .filter(s => !studentsToAssign.has(s.id))
              .map(s => ({
                student: s,
                distance: centroidLat && centroidLng
                  ? calculateDistance(centroidLat, centroidLng, s.parent_accounts.pickup_latitude, s.parent_accounts.pickup_longitude)
                  : 0,
              }))
              .sort((a, b) => a.distance - b.distance)
              .slice(0, availableSeats);

            if (nearbyStudents.length > 0) {
              nearbyStudents.forEach(ns => studentsToAssign.add(ns.student.id));

              routeUpdates.push({
                routeId: route.id,
                routeName: route.name,
                currentCount,
                maxSeats: route.max_seats,
                availableSeats,
                studentsToAdd: nearbyStudents.map(ns => ({
                  id: ns.student.id,
                  student_name: ns.student.student_name,
                  parent_name: ns.student.parent_accounts.parent_name,
                  lat: ns.student.parent_accounts.pickup_latitude,
                  lng: ns.student.parent_accounts.pickup_longitude,
                  status: ns.student.status,
                  distance: Math.round(ns.distance * 10) / 10,
                })),
              });
            }
          }
        }
      }

      // Remaining unassigned students (not suggested to add to existing routes)
      const remainingUnassigned = unassigned.filter(r => !studentsToAssign.has(r.id));

      if (remainingUnassigned.length === 0 && routeUpdates.length === 0) {
        return new Response(
          JSON.stringify({ suggestions: [], routeUpdates: [], message: "No unassigned students found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create new route suggestions for remaining students
      let suggestions: any[] = [];
      let school: any = null;

      if (remainingUnassigned.length > 0) {
        // Transform the data to match expected format
        const formattedStudents: RegistrationWithLocation[] = remainingUnassigned.map((r: any) => ({
          id: r.id,
          student_name: r.student_name,
          school_id: r.school_id,
          car_type: r.car_type,
          status: r.status,
          parent_accounts: Array.isArray(r.parent_accounts) ? r.parent_accounts[0] : r.parent_accounts,
          schools: Array.isArray(r.schools) ? r.schools[0] : r.schools,
        }));

        school = formattedStudents[0]?.schools;
        const clusters = clusterStudents(formattedStudents, maxSeatsPerRoute || 12);
        
        suggestions = clusters.map((cluster, idx) => {
          const optimized = optimizePickupOrder(cluster, school?.latitude || 0, school?.longitude || 0);
          const totalDistance = optimized.reduce((sum, student, i) => {
            if (i === 0) return sum;
            const prev = optimized[i - 1];
            return sum + calculateDistance(
              prev.parent_accounts.pickup_latitude,
              prev.parent_accounts.pickup_longitude,
              student.parent_accounts.pickup_latitude,
              student.parent_accounts.pickup_longitude
            );
          }, 0);

          return {
            name: `Route ${idx + 1} - ${cluster[0]?.parent_accounts.city || 'Area'}`,
            students: optimized.map((s, order) => ({
              id: s.id,
              student_name: s.student_name,
              parent_name: s.parent_accounts.parent_name,
              pickup_order: order + 1,
              lat: s.parent_accounts.pickup_latitude,
              lng: s.parent_accounts.pickup_longitude,
              status: s.status,
            })),
            estimatedDistance: Math.round(totalDistance * 10) / 10,
            studentCount: cluster.length,
            pendingFeesCount: cluster.filter(s => s.status === 'pending_fees').length,
          };
        });
      }

      // Use AI to generate additional insights
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      let aiInsights = "";

      if (LOVABLE_API_KEY && (suggestions.length > 0 || routeUpdates.length > 0)) {
        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: "You are a route optimization assistant. Provide brief, actionable insights about bus route planning. Keep responses under 100 words."
                },
                {
                  role: "user",
                  content: `I have ${suggestions.length} new route suggestions and ${routeUpdates.length} existing routes that can accept more students. ${routeUpdates.length > 0 ? `Existing routes can take ${routeUpdates.reduce((sum, r) => sum + r.studentsToAdd.length, 0)} more students.` : ''} Provide 2-3 quick tips.`
                }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiInsights = aiData.choices?.[0]?.message?.content || "";
          }
        } catch (aiError) {
          console.error("AI insights error:", aiError);
        }
      }

      return new Response(
        JSON.stringify({ 
          suggestions,
          routeUpdates,
          aiInsights,
          totalStudents: unassigned.length,
          studentsForExistingRoutes: studentsToAssign.size,
          studentsForNewRoutes: remainingUnassigned.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add-to-existing-route") {
      const { routeId: targetRouteId, students: studentsToAdd } = body;

      // Get current max pickup_order
      const { data: currentAssignments } = await supabase
        .from("route_assignments")
        .select("pickup_order")
        .eq("route_id", targetRouteId)
        .order("pickup_order", { ascending: false })
        .limit(1);

      let nextOrder = (currentAssignments?.[0]?.pickup_order || 0) + 1;

      // Insert new assignments
      const newAssignments = studentsToAdd.map((s: any, idx: number) => ({
        route_id: targetRouteId,
        registration_id: s.id,
        pickup_order: nextOrder + idx,
      }));

      const { error: insertError } = await supabase
        .from("route_assignments")
        .insert(newAssignments);

      if (insertError) throw insertError;

      // Optionally update route max_seats if needed
      const { data: route } = await supabase
        .from("routes")
        .select("max_seats")
        .eq("id", targetRouteId)
        .single();

      const { data: totalAssignments } = await supabase
        .from("route_assignments")
        .select("id")
        .eq("route_id", targetRouteId);

      const newTotal = totalAssignments?.length || 0;
      if (route && newTotal > route.max_seats) {
        await supabase
          .from("routes")
          .update({ max_seats: newTotal })
          .eq("id", targetRouteId);
      }

      return new Response(
        JSON.stringify({ success: true, addedCount: studentsToAdd.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "optimize-route") {
      // routeId already extracted from body above

      // Get route with assignments
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .select(`
          *,
          schools (latitude, longitude)
        `)
        .eq("id", routeId)
        .single();

      if (routeError) throw routeError;

      const { data: assignments, error: assignError } = await supabase
        .from("route_assignments")
        .select(`
          *,
          registrations (
            id,
            student_name,
            parent_accounts (
              pickup_latitude,
              pickup_longitude
            )
          )
        `)
        .eq("route_id", routeId);

      if (assignError) throw assignError;

      const students = (assignments || []).map(a => ({
        id: a.registrations.id,
        student_name: a.registrations.student_name,
        parent_accounts: a.registrations.parent_accounts,
      })) as any[];

      const optimized = optimizePickupOrder(students, route.schools.latitude, route.schools.longitude);
      
      // Update pickup orders
      for (let i = 0; i < optimized.length; i++) {
        await supabase
          .from("route_assignments")
          .update({ pickup_order: i + 1 })
          .eq("route_id", routeId)
          .eq("registration_id", optimized[i].id);
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          optimizedOrder: optimized.map((s, i) => ({
            registration_id: s.id,
            student_name: s.student_name,
            pickup_order: i + 1,
          }))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create-suggested-route") {
      // All values already extracted from body above

      // Create the route
      const { data: newRoute, error: createError } = await supabase
        .from("routes")
        .insert({
          name: suggestion.name,
          school_id: schoolId,
          car_type: carType,
          max_seats: suggestion.students.length,
          driver_id: driverId || null,
          supervisor_id: supervisorId || null,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Create assignments
      const assignments = suggestion.students.map((s: any) => ({
        route_id: newRoute.id,
        registration_id: s.id,
        pickup_order: s.pickup_order,
      }));

      const { error: assignError } = await supabase
        .from("route_assignments")
        .insert(assignments);

      if (assignError) throw assignError;

      return new Response(
        JSON.stringify({ success: true, route: newRoute }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Route Planner error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
