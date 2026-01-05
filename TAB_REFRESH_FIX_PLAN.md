# Tab Refresh Issue - Detailed Fix Plan

## Executive Summary

The web application is refreshing when users switch tabs or apps, even after brief periods (seconds/minutes). This is caused by flawed inactivity detection logic in `AppShell.tsx` that doesn't properly distinguish between tab-hidden duration and actual user inactivity.

---

## Root Cause Analysis

### Primary Issue
The current implementation checks **total inactivity time** since last user activity, but **doesn't track how long the tab was actually hidden**. This causes false positives when:
- User opens page, doesn't interact immediately
- User switches tabs briefly (seconds/minutes)
- Tab returns visible after 30+ minutes since page load
- System incorrectly thinks user was inactive for 30+ minutes

### Secondary Issues

1. **Unused Constant**: `MIN_IDLE_DURATION_MS` (5 minutes) is defined but never used
2. **No Tab Hidden Tracking**: `LAST_HIDDEN_STORAGE_KEY` is defined but never used
3. **Activity Time Initialization**: Set to page load time, not actual user activity
4. **Missing Validation**: No check to ensure timestamps are reasonable/valid
5. **Race Conditions**: Activity tracking might miss rapid tab switches

---

## Issues Identified

### Issue #1: Missing Tab Hidden Duration Tracking
**Location**: `src/components/app-shell/AppShell.tsx:102-177`

**Problem**: 
- Code only checks `inactivityDuration = Date.now() - lastActivityTime`
- Doesn't check how long tab was actually hidden
- If page loaded 30+ minutes ago, refresh triggers even if tab was only hidden for seconds

**Current Logic Flow**:
```
Page Load (10:00 AM) → Activity Time = 10:00 AM
User views (no interaction) → Activity Time still = 10:00 AM
User switches tab (10:05 AM) → No tracking
User returns (10:35 AM) → inactivityDuration = 35 minutes → REFRESH ❌
```

**Expected Behavior**:
```
Page Load (10:00 AM) → Activity Time = 10:00 AM
User views (no interaction) → Activity Time still = 10:00 AM
User switches tab (10:05 AM) → Tab Hidden Time = 10:05 AM
User returns (10:35 AM) → Tab Hidden Duration = 30 min, Inactivity = 35 min
→ Should check: Was tab hidden for 30+ min? Yes. Was user inactive 30+ min? Yes. → REFRESH ✅
```

### Issue #2: Unused MIN_IDLE_DURATION_MS Constant
**Location**: `src/components/app-shell/AppShell.tsx:17`

**Problem**:
- Constant defined but never checked in refresh logic
- Intended to prevent false positives from brief inactivity
- Should be used to ensure minimum inactivity before refresh

### Issue #3: Activity Time Not Updated on Tab Visible
**Location**: `src/components/app-shell/AppShell.tsx:102-105`

**Problem**:
- When tab becomes visible, activity time isn't updated if user was recently active
- If user was active right before switching tabs, returning should reset the clock
- Currently, old activity time persists

### Issue #4: No Validation of Timestamps
**Location**: `src/components/app-shell/AppShell.tsx:119-126`

**Problem**:
- No validation that parsed timestamps are valid numbers
- No check for NaN or invalid dates
- Could cause unexpected behavior with corrupted sessionStorage

### Issue #5: LAST_HIDDEN_STORAGE_KEY Defined But Unused
**Location**: `src/components/app-shell/AppShell.tsx:19`

**Problem**:
- Key defined but never set or read
- Should be used to track when tab became hidden

---

## Detailed Fix Plan

### Fix Strategy Overview

1. **Track Tab Hidden Time**: Store timestamp when tab becomes hidden
2. **Track Tab Visible Time**: Store timestamp when tab becomes visible
3. **Calculate Tab Hidden Duration**: Only consider refresh if tab was hidden for significant time
4. **Use MIN_IDLE_DURATION_MS**: Enforce minimum inactivity threshold
5. **Improve Activity Tracking**: Update activity time intelligently
6. **Add Validation**: Validate all timestamps before use
7. **Better Edge Case Handling**: Handle rapid tab switches, stale sessions

---

## Implementation Steps

### Step 1: Update Constants (Optional Enhancement)

**File**: `src/components/app-shell/AppShell.tsx`

**Changes**:
```typescript
// Add new constant for minimum tab hidden duration
const MIN_TAB_HIDDEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes minimum tab hidden time
```

**Rationale**: Prevents refresh if tab was only hidden briefly, even if user was inactive.

---

### Step 2: Modify handleVisibilityChange to Track Tab Hidden State

**File**: `src/components/app-shell/AppShell.tsx`

**Current Code** (lines 102-177):
```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState !== "visible") {
    return;  // ❌ Doesn't track when tab becomes hidden
  }
  // ... rest of logic
};
```

**New Code**:
```typescript
const handleVisibilityChange = () => {
  const now = Date.now();
  
  if (document.visibilityState === "hidden") {
    // Tab is being hidden - store the timestamp
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

    // NEW: Combined validation logic
    // Only refresh if ALL conditions are met:
    // 1. User has been inactive for at least INACTIVITY_THRESHOLD_MS (30 min)
    // 2. User has been inactive for at least MIN_IDLE_DURATION_MS (5 min) - prevents false positives
    // 3. Tab was hidden for at least MIN_TAB_HIDDEN_DURATION_MS (5 min) - prevents refresh on brief switches
    // 4. Inactivity duration is within reasonable bounds (not stale, not too old)
    
    const meetsInactivityThreshold = inactivityDuration >= INACTIVITY_THRESHOLD_MS;
    const meetsMinIdleDuration = inactivityDuration >= MIN_IDLE_DURATION_MS;
    const meetsTabHiddenDuration = tabHiddenDuration >= MIN_TAB_HIDDEN_DURATION_MS;
    const isWithinReasonableBounds = inactivityDuration <= MAX_IDLE_DURATION_MS;
    
    // If tab wasn't hidden (user was on page the whole time), don't refresh
    // This handles the case where user is just viewing without interacting
    const shouldConsiderRefresh = tabHiddenDuration > 0 || meetsInactivityThreshold;
    
    if (!meetsInactivityThreshold || 
        !meetsMinIdleDuration || 
        !isWithinReasonableBounds ||
        (tabHiddenDuration > 0 && !meetsTabHiddenDuration) ||
        !shouldConsiderRefresh) {
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

    // Schedule a controlled refresh after a short grace period.
    // Any user activity during this window cancels the refresh.
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

**Key Changes**:
1. ✅ Track when tab becomes hidden (store timestamp)
2. ✅ Calculate tab hidden duration
3. ✅ Use `MIN_IDLE_DURATION_MS` to prevent false positives
4. ✅ Add `MIN_TAB_HIDDEN_DURATION_MS` check
5. ✅ Validate all timestamps (NaN, <= 0 checks)
6. ✅ Combined validation logic (all conditions must be met)
7. ✅ Clear tab hidden timestamp after refresh or when conditions not met
8. ✅ Better logging for debugging

---

### Step 3: Improve Activity Time Initialization

**File**: `src/components/app-shell/AppShell.tsx`

**Current Code** (lines 63-73):
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

**New Code**:
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

**Key Changes**:
1. ✅ Validate stored timestamps before using
2. ✅ Only initialize if missing or invalid
3. ✅ Clear tab hidden timestamp on page load
4. ✅ Better handling of stale session data

---

### Step 4: Update Activity Tracking to Handle Tab Visibility

**File**: `src/components/app-shell/AppShell.tsx`

**Current Code** (lines 75-84):
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

**New Code**:
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

**Key Changes**:
1. ✅ Clear tab hidden timestamp on activity (user is back and active)

---

## Complete Fixed Code

### Full Updated handleVisibilityChange Function

```typescript
// Add new constant at top of file (after line 18)
const MIN_TAB_HIDDEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes minimum tab hidden time

// ... inside useEffect, replace handleVisibilityChange function:

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

## Testing Plan

### Test Cases

#### Test Case 1: Brief Tab Switch (Should NOT Refresh)
1. Open application
2. Wait 1 minute without interaction
3. Switch to another tab
4. Wait 10 seconds
5. Return to application tab
6. **Expected**: No refresh should occur

#### Test Case 2: Long Tab Switch with Inactivity (Should Refresh)
1. Open application
2. Wait 1 minute without interaction
3. Switch to another tab
4. Wait 35 minutes
5. Return to application tab
6. **Expected**: Refresh should occur after 5-second grace period

#### Test Case 3: Active User, Brief Tab Switch (Should NOT Refresh)
1. Open application
2. Interact with page (click, scroll)
3. Switch to another tab immediately
4. Wait 10 seconds
5. Return to application tab
6. **Expected**: No refresh should occur (recent activity)

#### Test Case 4: Active User, Long Tab Switch (Should NOT Refresh)
1. Open application
2. Interact with page (click, scroll)
3. Switch to another tab
4. Wait 35 minutes
5. Return to application tab
6. **Expected**: No refresh should occur (activity was recent before switch)

#### Test Case 5: Very Long Inactivity, Tab Always Visible (Edge Case)
1. Open application
2. Don't interact, don't switch tabs
3. Wait 35 minutes
4. **Expected**: No refresh should occur (tab was never hidden)

#### Test Case 6: Rapid Tab Switching (Should NOT Refresh)
1. Open application
2. Rapidly switch tabs multiple times (within 1 minute)
3. **Expected**: No refresh should occur

#### Test Case 7: User Activity During Grace Period (Should Cancel Refresh)
1. Open application
2. Wait 1 minute without interaction
3. Switch to another tab
4. Wait 35 minutes
5. Return to application tab
6. Immediately interact (click, scroll) within 5 seconds
7. **Expected**: Refresh should be cancelled

#### Test Case 8: Stale Session Data (Should Handle Gracefully)
1. Manually set corrupted sessionStorage values
2. Open application
3. **Expected**: Should reset timestamps and not crash

---

## Edge Cases Handled

1. ✅ **Rapid Tab Switches**: Tab hidden duration check prevents refresh
2. ✅ **No User Interaction**: Activity time validation prevents false positives
3. ✅ **Stale Session Data**: Timestamp validation and reset logic
4. ✅ **Tab Never Hidden**: Won't refresh if tab was always visible
5. ✅ **User Activity During Grace Period**: Activity tracking cancels refresh
6. ✅ **Multiple Visibility Changes**: Timeout management prevents multiple refreshes
7. ✅ **SessionStorage Errors**: Try-catch blocks handle storage failures
8. ✅ **Invalid Timestamps**: NaN and <= 0 checks prevent crashes

---

## Implementation Checklist

- [ ] Add `MIN_TAB_HIDDEN_DURATION_MS` constant
- [ ] Update `handleVisibilityChange` to track tab hidden state
- [ ] Add tab hidden duration calculation
- [ ] Implement combined validation logic
- [ ] Add timestamp validation (NaN, <= 0 checks)
- [ ] Update activity time initialization
- [ ] Update `updateActivityTime` to clear tab hidden timestamp
- [ ] Test all test cases
- [ ] Verify console logs for debugging
- [ ] Test in different browsers (Chrome, Firefox, Edge)
- [ ] Test on mobile devices (if applicable)

---

## Rollback Plan

If issues occur after deployment:

1. **Quick Fix**: Increase `MIN_TAB_HIDDEN_DURATION_MS` to 10 minutes
2. **Disable Feature**: Comment out the refresh logic temporarily
3. **Revert**: Use git to revert to previous version

---

## Performance Considerations

- **Minimal Impact**: Only adds 1 sessionStorage read/write on tab visibility change
- **No Memory Leaks**: All timeouts are properly cleaned up
- **Efficient**: Validation checks exit early when conditions not met

---

## Browser Compatibility

- ✅ Chrome/Edge (Chromium): Full support
- ✅ Firefox: Full support
- ✅ Safari: Full support
- ✅ Mobile browsers: Full support

All modern browsers support:
- `document.visibilityState`
- `visibilitychange` event
- `sessionStorage`

---

## Summary

This fix addresses the root cause by:
1. **Tracking tab hidden duration** separately from user inactivity
2. **Using all defined constants** (MIN_IDLE_DURATION_MS, LAST_HIDDEN_STORAGE_KEY)
3. **Adding proper validation** for all timestamps
4. **Implementing combined logic** that requires multiple conditions
5. **Handling edge cases** gracefully

The fix ensures refreshes only occur when:
- User has been inactive for 30+ minutes
- Tab was hidden for 5+ minutes
- All timestamps are valid
- User doesn't interact during grace period

This prevents false positives from brief tab switches while maintaining the intended refresh behavior for truly inactive sessions.

