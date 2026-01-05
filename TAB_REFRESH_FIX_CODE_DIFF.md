# Tab Refresh Fix - Code Changes

This document shows the exact code changes needed to fix the tab refresh issue.

---

## File: `src/components/app-shell/AppShell.tsx`

### Change 1: Add New Constant

**Location**: After line 18

**Add**:
```typescript
const MIN_TAB_HIDDEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes minimum tab hidden time
```

---

### Change 2: Update Activity Time Initialization

**Location**: Lines 63-73

**Replace**:
```typescript
try {
  const storedLoadTime = sessionStorage.getItem(PAGE_LOAD_TIME_KEY);
  if (!storedLoadTime) {
    sessionStorage.setItem(PAGE_LOAD_TIME_KEY, pageLoadTime.toString());
  }
  
  // Initialize activity time on page load
  sessionStorage.setItem(ACTIVITY_TIME_KEY, pageLoadTime.toString());
} catch (error) {
  // Ignore storage errors
}
```

**With**:
```typescript
try {
  const storedLoadTime = sessionStorage.getItem(PAGE_LOAD_TIME_KEY);
  const storedActivityTime = sessionStorage.getItem(ACTIVITY_TIME_KEY);
  
  // Only set page load time if it doesn't exist
  if (!storedLoadTime) {
    sessionStorage.setItem(PAGE_LOAD_TIME_KEY, pageLoadTime.toString());
  } else {
    // Validate stored page load time
    const storedLoadTimeNum = parseInt(storedLoadTime, 10);
    if (isNaN(storedLoadTimeNum) || storedLoadTimeNum <= 0) {
      sessionStorage.setItem(PAGE_LOAD_TIME_KEY, pageLoadTime.toString());
    }
  }
  
  // Initialize activity time only if it doesn't exist or is invalid
  if (!storedActivityTime) {
    sessionStorage.setItem(ACTIVITY_TIME_KEY, pageLoadTime.toString());
  } else {
    // Validate stored activity time
    const storedActivityTimeNum = parseInt(storedActivityTime, 10);
    const storedLoadTimeNum = parseInt(storedLoadTime || pageLoadTime.toString(), 10);
    
    // If activity time is invalid or from previous session, reset it
    if (isNaN(storedActivityTimeNum) || 
        storedActivityTimeNum <= 0 || 
        (storedLoadTimeNum && storedActivityTimeNum < storedLoadTimeNum)) {
      sessionStorage.setItem(ACTIVITY_TIME_KEY, pageLoadTime.toString());
    }
  }
  
  // Clear tab hidden timestamp on page load (fresh start)
  try {
    sessionStorage.removeItem(LAST_HIDDEN_STORAGE_KEY);
  } catch {
    // Ignore
  }
} catch (error) {
  // Ignore storage errors
}
```

---

### Change 3: Update updateActivityTime Function

**Location**: Lines 75-84

**Replace**:
```typescript
const updateActivityTime = () => {
  try {
    sessionStorage.setItem(ACTIVITY_TIME_KEY, Date.now().toString());
    // Allow future refreshes after new activity
    sessionStorage.setItem(HAS_REFRESHED_STORAGE_KEY, "false");
  } catch (error) {
    // Ignore storage errors
  }
};
```

**With**:
```typescript
const updateActivityTime = () => {
  try {
    const now = Date.now();
    sessionStorage.setItem(ACTIVITY_TIME_KEY, now.toString());
    // Allow future refreshes after new activity
    sessionStorage.setItem(HAS_REFRESHED_STORAGE_KEY, "false");
    // Clear tab hidden timestamp when user is active
    sessionStorage.removeItem(LAST_HIDDEN_STORAGE_KEY);
  } catch (error) {
    // Ignore storage errors
  }
};
```

---

### Change 4: Replace handleVisibilityChange Function

**Location**: Lines 101-177

**Replace entire function** with:

```typescript
// When the tab becomes visible again, check if we've been idle long enough
const handleVisibilityChange = () => {
  const now = Date.now();
  
  // Track when tab becomes hidden
  if (document.visibilityState === "hidden") {
    try {
      sessionStorage.setItem(LAST_HIDDEN_STORAGE_KEY, now.toString());
    } catch (error) {
      // Ignore storage errors
    }
    return;
  }
  
  // Tab is becoming visible - check if refresh is needed
  if (document.visibilityState !== "visible") {
    return;
  }

  try {
    // Check if we've already refreshed in this session
    const refreshedFlag = sessionStorage.getItem(HAS_REFRESHED_STORAGE_KEY);
    if (refreshedFlag === "true") {
      return;
    }

    // Get last activity time
    const lastActivityStr = sessionStorage.getItem(ACTIVITY_TIME_KEY);
    if (!lastActivityStr) {
      sessionStorage.setItem(ACTIVITY_TIME_KEY, now.toString());
      return;
    }

    const lastActivityTime = parseInt(lastActivityStr, 10);
    
    // Validate timestamp
    if (isNaN(lastActivityTime) || lastActivityTime <= 0) {
      sessionStorage.setItem(ACTIVITY_TIME_KEY, now.toString());
      return;
    }

    // Get page load time for validation
    const pageLoadTimestamp = sessionStorage.getItem(PAGE_LOAD_TIME_KEY);
    
    // Ignore if timestamp is from previous session
    if (pageLoadTimestamp) {
      const pageLoadTime = parseInt(pageLoadTimestamp, 10);
      if (!isNaN(pageLoadTime) && lastActivityTime < pageLoadTime) {
        sessionStorage.setItem(ACTIVITY_TIME_KEY, now.toString());
        return;
      }
    }

    // Calculate inactivity duration
    const inactivityDuration = now - lastActivityTime;

    // Get tab hidden timestamp
    const lastHiddenStr = sessionStorage.getItem(LAST_HIDDEN_STORAGE_KEY);
    let tabHiddenDuration = 0;
    
    if (lastHiddenStr) {
      const lastHiddenTime = parseInt(lastHiddenStr, 10);
      if (!isNaN(lastHiddenTime) && lastHiddenTime > 0) {
        tabHiddenDuration = now - lastHiddenTime;
      }
    }

    // Combined validation logic
    // Only refresh if ALL conditions are met:
    const meetsInactivityThreshold = inactivityDuration >= INACTIVITY_THRESHOLD_MS;
    const meetsMinIdleDuration = inactivityDuration >= MIN_IDLE_DURATION_MS;
    const meetsTabHiddenDuration = tabHiddenDuration === 0 || tabHiddenDuration >= MIN_TAB_HIDDEN_DURATION_MS;
    const isWithinReasonableBounds = inactivityDuration <= MAX_IDLE_DURATION_MS;
    
    // If tab wasn't hidden and user hasn't been inactive long enough, don't refresh
    if (!meetsInactivityThreshold || 
        !meetsMinIdleDuration || 
        !isWithinReasonableBounds ||
        !meetsTabHiddenDuration) {
      // Clear tab hidden timestamp since we're not refreshing
      if (lastHiddenStr) {
        try {
          sessionStorage.removeItem(LAST_HIDDEN_STORAGE_KEY);
        } catch {
          // Ignore
        }
      }
      return;
    }

    // Schedule a controlled refresh after a short grace period
    if (visibilityChangeTimeoutRef.current) {
      clearTimeout(visibilityChangeTimeoutRef.current);
    }

    visibilityChangeTimeoutRef.current = setTimeout(() => {
      try {
        // Double-check conditions haven't changed
        const refreshed = sessionStorage.getItem(HAS_REFRESHED_STORAGE_KEY);
        if (refreshed === "true") {
          return;
        }

        const latestActivityStr = sessionStorage.getItem(ACTIVITY_TIME_KEY);
        if (!latestActivityStr) return;

        const latestActivityTime = parseInt(latestActivityStr, 10);
        if (isNaN(latestActivityTime) || latestActivityTime <= 0) return;

        const latestInactivity = Date.now() - latestActivityTime;
        
        // Re-validate conditions
        if (
          latestInactivity < INACTIVITY_THRESHOLD_MS ||
          latestInactivity < MIN_IDLE_DURATION_MS ||
          latestInactivity > MAX_IDLE_DURATION_MS
        ) {
          return;
        }

        // Check tab hidden duration again
        const latestHiddenStr = sessionStorage.getItem(LAST_HIDDEN_STORAGE_KEY);
        if (latestHiddenStr) {
          const latestHiddenTime = parseInt(latestHiddenStr, 10);
          if (!isNaN(latestHiddenTime) && latestHiddenTime > 0) {
            const latestTabHiddenDuration = Date.now() - latestHiddenTime;
            if (latestTabHiddenDuration < MIN_TAB_HIDDEN_DURATION_MS) {
              return; // Tab wasn't hidden long enough
            }
          }
        }

        console.log("[AppShell] REFRESH TRIGGERED after long inactivity (visibilitychange)", {
          inactivityDuration: latestInactivity,
          tabHiddenDuration: latestHiddenStr ? Date.now() - parseInt(latestHiddenStr, 10) : 0
        });
        
        sessionStorage.setItem(HAS_REFRESHED_STORAGE_KEY, "true");
        
        // Clear tab hidden timestamp
        try {
          sessionStorage.removeItem(LAST_HIDDEN_STORAGE_KEY);
        } catch {
          // Ignore
        }
        
        window.location.reload();
      } catch (error) {
        console.error("[AppShell] Error during inactivity refresh:", error);
      } finally {
        visibilityChangeTimeoutRef.current = null;
      }
    }, 5000); // 5s grace period
  } catch (error) {
    console.error("[AppShell] Error in visibility change handler:", error);
  }
};
```

---

## Summary of Changes

1. **Added constant**: `MIN_TAB_HIDDEN_DURATION_MS` (5 minutes)
2. **Enhanced initialization**: Validates stored timestamps, clears tab hidden timestamp on load
3. **Updated activity tracking**: Clears tab hidden timestamp when user is active
4. **Completely rewrote visibility handler**: 
   - Tracks when tab becomes hidden
   - Calculates tab hidden duration
   - Uses all validation constants
   - Validates all timestamps
   - Implements combined validation logic

---

## Quick Implementation Steps

1. Open `src/components/app-shell/AppShell.tsx`
2. Add `MIN_TAB_HIDDEN_DURATION_MS` constant (after line 18)
3. Replace activity time initialization (lines 63-73)
4. Replace `updateActivityTime` function (lines 75-84)
5. Replace `handleVisibilityChange` function (lines 101-177)
6. Save and test

---

## Testing

After implementing, test these scenarios:

1. ✅ Brief tab switch (should NOT refresh)
2. ✅ Long tab switch with inactivity (should refresh)
3. ✅ Active user, brief tab switch (should NOT refresh)
4. ✅ User activity during grace period (should cancel refresh)

Check browser console for debug logs when refresh is triggered.

