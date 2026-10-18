// Values one screen sets and another screen reads and then clears.
// They live in one shared object so every file sees the same values.
export const pending = {
  // Set by the bell when someone taps a message thread; the Students screen (staff)
  // or the child page (parents) opens that student's messages.
  messageStudentId: null,

  // Lets a tap on a child on the Dashboard open that child's profile directly.
  childProfileId: null,

  // Set by the weekly update card on the Dashboard: the child page scrolls to Weekly updates.
  scrollToWeekly: false,
};
