# 🤝 AI Handoff Guide - Claude Code ↔️ Cursor

**Purpose**: Enable seamless collaboration between Claude Code and Cursor AI

---

## 🎯 The System

### Core Concept
- **CURRENT_WORK.md** = The "handoff file"
- Both AIs read it before starting
- Both AIs update it before finishing
- Always has latest status, active task, and next steps

### Why This Works
✅ No lost context between AI switches
✅ Clear handoff protocol
✅ Always know what was done and what's next
✅ Prevents duplicate work
✅ Maintains project continuity

---

## 📖 How to Use (For User - Nadav)

### Switching from Claude Code to Cursor

1. **Tell Claude Code**: "I'm moving to Cursor now"
   - Claude will update CURRENT_WORK.md
   - Claude will note any incomplete work

2. **Open Cursor IDE**

3. **Tell Cursor**:
   ```
   Read CURRENT_WORK.md and continue from where Claude Code left off.

   Priority: [mention the priority if you know it]
   ```

4. **Cursor will**:
   - Read CURRENT_WORK.md
   - Acknowledge what Claude did
   - Continue seamlessly

### Switching from Cursor to Claude Code

1. **Tell Cursor**: "I'm going back to Claude Code"
   - Cursor updates CURRENT_WORK.md
   - Cursor documents what was done

2. **Open Claude Code CLI**

3. **Tell Claude Code**:
   ```
   Read CURRENT_WORK.md and continue from where Cursor left off.
   ```

4. **Claude will**:
   - Read CURRENT_WORK.md
   - Acknowledge what Cursor did
   - Continue seamlessly

---

## 🤖 Protocol for AIs (Claude Code & Cursor)

### When User Says "Moving to [Other AI]"

**IMMEDIATELY**:
1. ✅ Read CURRENT_WORK.md
2. ✅ Update "Last Updated" with your name and timestamp
3. ✅ Update "ACTIVE TASK" section with:
   - What you just did
   - What's incomplete (if any)
   - What should be done next
4. ✅ Add entry to "RECENT CHANGES" section
5. ✅ Update "CURRENT STATE" if anything changed
6. ✅ Confirm handoff: "CURRENT_WORK.md has been updated. Cursor is ready to take over."

### When User Says "Continue from [Other AI]"

**IMMEDIATELY**:
1. ✅ Read CURRENT_WORK.md FIRST
2. ✅ Acknowledge what the other AI did:
   - "I've read the handoff. I see [Other AI] completed X and Y. The active task is Z."
3. ✅ Ask if user wants to:
   - Continue with ACTIVE TASK
   - OR work on something else
4. ✅ Proceed based on user's choice
5. ✅ Update CURRENT_WORK.md when you make progress

### During Normal Work

**EVERY TIME** you complete a significant task:
1. ✅ Update "RECENT CHANGES" section
2. ✅ Update "ACTIVE TASK" if changed
3. ✅ Update "NEXT PRIORITIES" if changed
4. ✅ Update timestamp

---

## 📝 What Goes in CURRENT_WORK.md

### Critical Sections (Must Always Be Updated)

1. **CURRENT STATE**
   - What works
   - What's pending
   - Current issues

2. **ACTIVE TASK**
   - What's being worked on RIGHT NOW
   - Who started it
   - Status (started/in-progress/blocked/complete)
   - Exact steps to continue

3. **NEXT PRIORITIES**
   - Ordered list of what should be done next
   - Estimated time for each
   - Priority level (🔴 HIGH, 🟡 MEDIUM, 🟢 LOW)

4. **RECENT CHANGES**
   - What was just done
   - Who did it
   - When
   - Files created/modified
   - Status after changes

---

## ✅ Handoff Checklist

### Before Handoff (AI Leaving)
- [ ] Updated "Last Updated" at top
- [ ] Documented all work done in "RECENT CHANGES"
- [ ] Noted any incomplete work in "ACTIVE TASK"
- [ ] Updated "CURRENT STATE" with new status
- [ ] Updated "NEXT PRIORITIES" if changed
- [ ] Listed any issues encountered
- [ ] Confirmed file is saved

### After Handoff (AI Taking Over)
- [ ] Read entire CURRENT_WORK.md
- [ ] Acknowledged previous AI's work
- [ ] Asked user about priorities
- [ ] Started working on ACTIVE TASK or new priority
- [ ] Committed to updating file regularly

---

## 🎯 Success Criteria

### Handoff is Successful When:
✅ No context is lost between switches
✅ New AI knows exactly what was done
✅ New AI knows exactly what to do next
✅ No duplicate work happens
✅ No confusion about project state
✅ Smooth transition with zero friction

### Handoff Failed If:
❌ New AI doesn't know what was done
❌ New AI asks questions that were answered
❌ New AI repeats work already completed
❌ New AI doesn't update CURRENT_WORK.md
❌ File becomes stale/outdated

---

## 💡 Best Practices

### For User (Nadav)

1. **Always mention the handoff explicitly**:
   - Good: "I'm switching to Cursor now"
   - Bad: Just closing Claude without saying anything

2. **Give the new AI context**:
   - Good: "Read CURRENT_WORK.md and continue the RLS fix"
   - Bad: "Fix the profile issue" (without mentioning handoff)

3. **Trust the system**:
   - The file has all the context
   - Both AIs will maintain it
   - No need to re-explain everything

### For AIs (Claude Code & Cursor)

1. **ALWAYS read CURRENT_WORK.md first** when user mentions the other AI

2. **ALWAYS update CURRENT_WORK.md** before and after major tasks

3. **Be specific in updates**:
   - Good: "Fixed RLS policy by adding INSERT policy for profiles table"
   - Bad: "Fixed some stuff"

4. **Acknowledge the other AI's work**:
   - Good: "I see Cursor fixed the RLS policy. I'll now work on Google OAuth setup."
   - Bad: Starting work without acknowledging context

5. **Keep the file current**:
   - Update timestamps
   - Remove completed tasks from ACTIVE TASK
   - Add new priorities as they emerge

---

## 🔄 Example Handoff

### Scenario: User switches from Claude Code to Cursor

**User to Claude Code**: "I'm moving to Cursor now"

**Claude Code**:
```
I'll update the handoff file for Cursor.

[Updates CURRENT_WORK.md with:]
- Last Updated: Claude Code - 2026-01-13 14:30
- Active Task: Started RLS policy fix, SQL query written but not executed yet
- Recent Changes: Added RLS policy SQL to ACTIVE TASK section
- Next: Execute SQL in Supabase, test signup, then move to Google OAuth

CURRENT_WORK.md has been updated. Cursor can take over from here.
```

---

**User opens Cursor**

**User to Cursor**: "Read CURRENT_WORK.md and continue from where Claude Code left off"

**Cursor**:
```
I've read the handoff file. I can see Claude Code:
- Wrote the RLS policy SQL query
- Documented it in CURRENT_WORK.md
- Needs to be executed in Supabase SQL Editor
- After that, test signup flow

I'll execute the SQL policy now. Should I proceed?
```

**User**: "Yes, proceed"

**Cursor executes the policy, tests signup, updates CURRENT_WORK.md**:
```
Done! I've:
- ✅ Executed RLS policy in Supabase
- ✅ Tested signup - works perfectly now
- ✅ Updated CURRENT_WORK.md with completion
- ✅ Moved "Enable Google OAuth" to ACTIVE TASK

What would you like to work on next?
- Fix Google OAuth (5 minutes)
- Start payment flow (2-3 hours)
- Build inventory UI (2-3 hours)
```

---

## 📋 Quick Commands

### For User (Nadav)

**Switching to Cursor**:
```
"I'm moving to Cursor now, update CURRENT_WORK.md"
```

**Switching to Claude Code**:
```
"I'm going back to Claude Code, update CURRENT_WORK.md"
```

**Starting with new AI**:
```
"Read CURRENT_WORK.md and continue from where [Other AI] left off"
```

**Checking status**:
```
"What's in CURRENT_WORK.md? What should we work on next?"
```

### For AIs

**Reading handoff**:
```javascript
// ALWAYS do this when user mentions the other AI
const handoff = await readFile('CURRENT_WORK.md');
// Parse and acknowledge
```

**Updating handoff**:
```javascript
// Do this before leaving and after major tasks
await updateFile('CURRENT_WORK.md', {
  lastUpdated: 'AI_NAME - TIMESTAMP',
  activeTask: 'What I just did / What needs to be done',
  recentChanges: 'Add new entry with details',
});
```

---

## 🎉 Benefits

### For User (Nadav)
✅ Switch between AIs anytime without losing context
✅ Each AI knows exactly what the other did
✅ No need to re-explain everything
✅ Clear visibility into what's done and what's next
✅ Both AIs work as a cohesive team

### For AIs (Claude Code & Cursor)
✅ Always have full context
✅ Never duplicate work
✅ Clear handoff protocol
✅ Know priorities and status
✅ Can continue seamlessly from each other

### For Project
✅ Continuous progress
✅ No context loss
✅ Clear documentation trail
✅ Easy to resume after breaks
✅ Professional workflow

---

## 🚨 Important Notes

1. **CURRENT_WORK.md is the source of truth**
   - Not the conversation history
   - Not memory
   - THE FILE is what matters

2. **Always update it**
   - Before leaving
   - After major changes
   - When switching AIs

3. **Both AIs are responsible**
   - Claude Code maintains it
   - Cursor maintains it
   - Both read it every handoff

4. **User can check it anytime**
   - Open the file to see current status
   - No need to ask AIs
   - Always up-to-date

---

**🤝 This system enables perfect collaboration between Claude Code and Cursor!**

Now you can use the best of both AIs seamlessly. 🚀
